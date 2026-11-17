terraform {
  required_providers { digitalocean = { source = "digitalocean/digitalocean", version = "~> 2.43" } }
}
provider "digitalocean" { token = var.do_token }

variable "do_token" { sensitive = true }
variable "ssh_key_fingerprint" {}
variable "repo_url" { description = "Git URL of this repository" }
variable "domain" { description = "e.g. yourdomain.dev (DNS managed in DigitalOcean)" }
variable "region" { default = "fra1" }
variable "size" { default = "s-2vcpu-4gb" }

resource "digitalocean_droplet" "forge" {
  name      = "deployforge"
  region    = var.region
  size      = var.size
  image     = "ubuntu-24-04-x64"
  ssh_keys  = [var.ssh_key_fingerprint]
  user_data = <<-EOT
    #!/bin/bash
    set -e
    curl -fsSL https://get.docker.com | sh
    git clone ${var.repo_url} /opt/deployforge
    cd /opt/deployforge
    cp .env.example .env
    sed -i "s|^DOMAIN=.*|DOMAIN=${var.domain}|; s|^PUBLIC_URL=.*|PUBLIC_URL=http://${var.domain}|; s|^SECRET_KEY=.*|SECRET_KEY=$(openssl rand -hex 32)|; s|^WEBHOOK_SECRET=.*|WEBHOOK_SECRET=$(openssl rand -hex 16)|" .env
    docker compose up -d --build
  EOT
}

resource "digitalocean_firewall" "forge" {
  name        = "deployforge"
  droplet_ids = [digitalocean_droplet.forge.id]
  inbound_rule { 
    protocol = "tcp"
    port_range = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  inbound_rule {
    protocol = "tcp"
    port_range = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  inbound_rule {
    protocol = "tcp"
    port_range = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol = "tcp"
    port_range = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol = "udp"
    port_range = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

resource "digitalocean_record" "root" {
  domain = var.domain
  type   = "A"
  name   = "@"
  value  = digitalocean_droplet.forge.ipv4_address
}
resource "digitalocean_record" "wildcard" {
  domain = var.domain
  type   = "A"
  name   = "*"
  value  = digitalocean_droplet.forge.ipv4_address
}

output "ip" { value = digitalocean_droplet.forge.ipv4_address }
