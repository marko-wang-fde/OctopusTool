package octopusedge

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadConfigAcceptsTCPServices(t *testing.T) {
	path := filepath.Join(t.TempDir(), "edge.yaml")
	if err := os.WriteFile(path, []byte(`
services:
  - name: Finance PostgreSQL
    target: 192.168.0.102:5432
  - name: Finance MySQL
    target: 192.168.0.100:3306
`), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	cfg, err := LoadConfig(path)
	if err != nil {
		t.Fatalf("load config: %v", err)
	}
	if len(cfg.Services) != 2 {
		t.Fatalf("unexpected services: %#v", cfg.Services)
	}
}

func TestConfigRejectsDuplicateServiceName(t *testing.T) {
	err := Config{Services: []ServiceConfig{
		{Name: "Finance PostgreSQL", Target: "127.0.0.1:5432"},
		{Name: "Finance PostgreSQL", Target: "127.0.0.1:5433"},
	}}.Validate()
	if err == nil || !strings.Contains(err.Error(), "duplicate service name") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestConfigRejectsInvalidTarget(t *testing.T) {
	err := Config{Services: []ServiceConfig{
		{Name: "Finance PostgreSQL", Target: "127.0.0.1"},
	}}.Validate()
	if err == nil || !strings.Contains(err.Error(), "target must be host:port") {
		t.Fatalf("unexpected error: %v", err)
	}
}
