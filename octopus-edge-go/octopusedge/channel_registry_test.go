package octopusedge

import (
	"strings"
	"testing"
)

func TestChannelRegistryBuildsManifestAndValidatesHostSync(t *testing.T) {
	registry, err := NewChannelRegistry([]ChannelSpec{
		{Name: "Finance PostgreSQL", Description: "finance database", Target: "127.0.0.1:5432"},
		{Name: "Private API", Target: "127.0.0.1:5000"},
	})
	if err != nil {
		t.Fatalf("new registry: %v", err)
	}

	manifest, err := registry.Manifest()
	if err != nil {
		t.Fatalf("manifest: %v", err)
	}
	if len(manifest) != 2 {
		t.Fatalf("unexpected manifest length: %#v", manifest)
	}
	if manifest[0].Name != "Finance PostgreSQL" || manifest[1].Name != "Private API" {
		t.Fatalf("manifest is not sorted by service name: %#v", manifest)
	}
	if manifest[0].Description != "finance database" {
		t.Fatalf("manifest missing description: %#v", manifest)
	}

	targets, err := registry.ApplySync(SyncServicesResult{Items: []SyncedService{
		{EdgeServiceID: "oes_pgsql", Name: "Finance PostgreSQL", Status: "active"},
		{EdgeServiceID: "oes_api", Name: "Private API", Status: "active"},
	}})
	if err != nil {
		t.Fatalf("apply sync: %v", err)
	}
	if len(targets) != 2 || targets[0].EdgeServiceID != "oes_pgsql" || targets[0].TargetPort != 5432 {
		t.Fatalf("unexpected broker targets: %#v", targets)
	}
}

func TestChannelRegistryRejectsUnexpectedSyncResult(t *testing.T) {
	registry, err := NewChannelRegistry([]ChannelSpec{{Name: "Private API", Target: "127.0.0.1:5000"}})
	if err != nil {
		t.Fatalf("new registry: %v", err)
	}

	_, err = registry.ApplySync(SyncServicesResult{Items: []SyncedService{{
		EdgeServiceID: "oes_other", Name: "Other API", Status: "active",
	}}})
	if err == nil || !strings.Contains(err.Error(), "unregistered service name=Other API") {
		t.Fatalf("expected unregistered service name error, got %v", err)
	}
}

func TestChannelRegistryRejectsDuplicateAndInvalidSpecs(t *testing.T) {
	if _, err := NewChannelRegistry([]ChannelSpec{{Name: "bad", Target: "127.0.0.1:notaport"}}); err == nil || !strings.Contains(err.Error(), "port") {
		t.Fatalf("expected invalid port error, got %v", err)
	}
	if _, err := NewChannelRegistry([]ChannelSpec{
		{Name: "api", Target: "127.0.0.1:5000"},
		{Name: "api", Target: "127.0.0.1:5001"},
	}); err == nil || !strings.Contains(err.Error(), "duplicate service name") {
		t.Fatalf("expected duplicate error, got %v", err)
	}
}
