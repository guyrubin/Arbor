output "project_id" {
  description = "GCP project ID"
  value       = google_project.arbor.project_id
}

output "project_number" {
  description = "GCP project number"
  value       = google_project.arbor.number
}

output "cloud_run_url" {
  description = "Public URL of the Arbor Cloud Run service"
  value       = google_cloud_run_v2_service.arbor_api.uri
}

output "artifact_registry" {
  description = "Artifact Registry Docker host for CI/CD"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/arbor"
}

output "exports_bucket" {
  description = "Cloud Storage bucket for handoff document exports"
  value       = google_storage_bucket.exports.name
}

output "cloudrun_service_account" {
  description = "Email of the Cloud Run service account"
  value       = google_service_account.cloudrun.email
}

output "firebase_web_config_hint" {
  description = "Reminder: retrieve Firebase web config from Firebase Console → Project Settings → Your apps"
  value       = "https://console.firebase.google.com/project/${var.project_id}/settings/general"
}
