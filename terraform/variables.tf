variable "project_id" {
  description = "GCP project ID (globally unique, e.g. arbor-prod-XXXXXX)"
  type        = string
}

variable "project_name" {
  description = "Human-readable GCP project name"
  type        = string
  default     = "Arbor Parenting Platform"
}

variable "billing_account" {
  description = "GCP billing account ID (format: XXXXXX-XXXXXX-XXXXXX)"
  type        = string
}

variable "org_id" {
  description = "GCP organisation ID (leave empty to create project under your personal account)"
  type        = string
  default     = ""
}

variable "region" {
  description = "Primary GCP region for Cloud Run, Vertex AI, and Artifact Registry"
  type        = string
  default     = "europe-west4"
}

variable "arbor_env" {
  description = "Arbor environment label (dev, stage, prod)"
  type        = string
  default     = "prod"
}

variable "alert_email" {
  description = "Email address for budget and error alerting"
  type        = string
  default     = ""
}

variable "monthly_budget_usd" {
  description = "Monthly budget cap in USD (triggers alert at 100%)"
  type        = number
  default     = 150
}
