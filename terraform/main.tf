terraform {
  required_version = ">= 1.7"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.0"
    }
  }
  # Uncomment to store state in GCS after the project exists:
  # backend "gcs" {
  #   bucket = "<your-state-bucket>"
  #   prefix = "terraform/arbor"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# ── GCP Project ──────────────────────────────────────────────────────────────
resource "google_project" "arbor" {
  name            = var.project_name
  project_id      = var.project_id
  billing_account = var.billing_account
  org_id          = var.org_id != "" ? var.org_id : null
}

# ── Enable required GCP APIs ─────────────────────────────────────────────────
locals {
  required_apis = [
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "aiplatform.googleapis.com",
    "firestore.googleapis.com",
    "firebase.googleapis.com",
    "firebasehosting.googleapis.com",
    "storage.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "billingbudgets.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "identitytoolkit.googleapis.com",
  ]
}

resource "google_project_service" "apis" {
  for_each = toset(local.required_apis)
  project  = google_project.arbor.project_id
  service  = each.value

  disable_on_destroy         = false
  disable_dependent_services = false

  depends_on = [google_project.arbor]
}

# ── Artifact Registry — Docker repository ────────────────────────────────────
resource "google_artifact_registry_repository" "arbor" {
  location      = var.region
  repository_id = "arbor"
  description   = "Arbor private-beta Docker images"
  format        = "DOCKER"

  depends_on = [google_project_service.apis]
}

# ── Service account for Cloud Run ────────────────────────────────────────────
resource "google_service_account" "cloudrun" {
  account_id   = "arbor-cloudrun"
  display_name = "Arbor Cloud Run Service Account"
  project      = google_project.arbor.project_id

  depends_on = [google_project_service.apis]
}

# IAM — Vertex AI user
resource "google_project_iam_member" "cloudrun_vertex" {
  project = google_project.arbor.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.cloudrun.email}"
}

# IAM — Firestore user
resource "google_project_iam_member" "cloudrun_firestore" {
  project = google_project.arbor.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.cloudrun.email}"
}

# IAM — Cloud Storage object admin (for handoff exports)
resource "google_project_iam_member" "cloudrun_storage" {
  project = google_project.arbor.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.cloudrun.email}"
}

# IAM — Secret Manager reader (for any future secrets)
resource "google_project_iam_member" "cloudrun_secrets" {
  project = google_project.arbor.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloudrun.email}"
}

# IAM — Log writer
resource "google_project_iam_member" "cloudrun_logging" {
  project = google_project.arbor.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.cloudrun.email}"
}

# ── Cloud Storage — handoff export bucket ────────────────────────────────────
resource "google_storage_bucket" "exports" {
  name          = "${var.project_id}-arbor-exports"
  location      = var.region
  project       = google_project.arbor.project_id
  force_destroy = false

  uniform_bucket_level_access = true

  lifecycle_rule {
    action { type = "Delete" }
    condition { age = 90 }  # Auto-delete exports after 90 days
  }

  versioning { enabled = false }

  depends_on = [google_project_service.apis]
}

# IAM — Cloud Run SA has object-level access; block public access
resource "google_storage_bucket_iam_binding" "exports_private" {
  bucket = google_storage_bucket.exports.name
  role   = "roles/storage.objectAdmin"
  members = [
    "serviceAccount:${google_service_account.cloudrun.email}",
  ]
}

# ── Firebase project ──────────────────────────────────────────────────────────
resource "google_firebase_project" "arbor" {
  provider = google-beta
  project  = google_project.arbor.project_id

  depends_on = [google_project_service.apis]
}

# ── Firestore (Native mode, europe-west4) ────────────────────────────────────
resource "google_firestore_database" "default" {
  project     = google_project.arbor.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  depends_on = [
    google_project_service.apis,
    google_firebase_project.arbor,
  ]
}

# ── Cloud Build — service account permission to deploy Cloud Run ──────────────
resource "google_project_iam_member" "cloudbuild_run_admin" {
  project = google_project.arbor.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_project.arbor.number}@cloudbuild.gserviceaccount.com"

  depends_on = [google_project_service.apis]
}

resource "google_project_iam_member" "cloudbuild_sa_user" {
  project = google_project.arbor.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_project.arbor.number}@cloudbuild.gserviceaccount.com"
}

resource "google_project_iam_member" "cloudbuild_ar_writer" {
  project = google_project.arbor.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_project.arbor.number}@cloudbuild.gserviceaccount.com"
}

# ── Cloud Run service (initial deploy placeholder) ────────────────────────────
# This resource will be managed by Cloud Build after the first deploy.
# Terraform manages the service account and CORS env var only.
resource "google_cloud_run_v2_service" "arbor_api" {
  name     = "arbor-api"
  location = var.region
  project  = google_project.arbor.project_id

  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloudrun.email

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/arbor/arbor-api:latest"

      env {
        name  = "ARBOR_ENV"
        value = var.arbor_env
      }
      env {
        name  = "MODEL_PROVIDER"
        value = "vertex"
      }
      env {
        name  = "MEMORY_ADAPTER"
        value = "firestore"
      }
      env {
        name  = "ENABLE_LOCAL_MEMORY_ADAPTER"
        value = "false"
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "FIREBASE_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCP_REGION"
        value = var.region
      }
      env {
        name  = "GCS_BUCKET_NAME"
        value = google_storage_bucket.exports.name
      }
      env {
        name  = "VERTEX_MODEL_CHAT"
        value = "gemini-2.5-pro"
      }
      env {
        name  = "VERTEX_MODEL_STORY"
        value = "gemini-2.5-pro"
      }
      env {
        name  = "VERTEX_MODEL_ANALYSIS"
        value = "gemini-2.5-pro"
      }
      env {
        name  = "VERTEX_MODEL_HANDOFF"
        value = "gemini-2.5-pro"
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        startup_cpu_boost = true
      }

      startup_probe {
        http_get { path = "/api/architecture/status" }
        initial_delay_seconds = 5
        period_seconds        = 10
        failure_threshold     = 5
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }
  }

  depends_on = [
    google_project_service.apis,
    google_artifact_registry_repository.arbor,
    google_service_account.cloudrun,
  ]

  lifecycle {
    ignore_changes = [
      # Cloud Build manages the image tag on each deploy
      template[0].containers[0].image,
    ]
  }
}

# ── Allow public (unauthenticated) access to the Cloud Run service ────────────
resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = google_cloud_run_v2_service.arbor_api.project
  location = google_cloud_run_v2_service.arbor_api.location
  name     = google_cloud_run_v2_service.arbor_api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ── Budget alert ──────────────────────────────────────────────────────────────
resource "google_billing_budget" "arbor" {
  count           = var.alert_email != "" ? 1 : 0
  billing_account = var.billing_account
  display_name    = "Arbor Monthly Budget"

  budget_filter {
    projects = ["projects/${google_project.arbor.number}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.monthly_budget_usd)
    }
  }

  threshold_rules {
    threshold_percent = 0.75
    spend_basis       = "CURRENT_SPEND"
  }
  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "CURRENT_SPEND"
  }

  depends_on = [google_project.arbor]
}
