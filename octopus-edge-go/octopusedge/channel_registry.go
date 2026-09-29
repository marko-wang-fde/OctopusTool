package octopusedge

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
)

type ChannelSpec struct {
	Name        string
	Description string
	Target      string
}

type ChannelRegistry struct {
	mu       sync.RWMutex
	channels map[string]*channelRecord
}

type channelRecord struct {
	name        string
	description string
	targetHost  string
	targetPort  int
}

type BrokerServiceTarget struct {
	EdgeServiceID string
	Name          string
	TargetHost    string
	TargetPort    int
}

func NewChannelRegistry(specs []ChannelSpec) (*ChannelRegistry, error) {
	registry := &ChannelRegistry{
		channels: make(map[string]*channelRecord),
	}
	for _, spec := range specs {
		record, err := newChannelRecord(spec)
		if err != nil {
			return nil, err
		}
		if _, ok := registry.channels[record.name]; ok {
			return nil, fmt.Errorf("duplicate service name: %s", record.name)
		}
		registry.channels[record.name] = record
	}
	return registry, nil
}

func (r *ChannelRegistry) Manifest() ([]ServiceManifestItem, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	keys := make([]string, 0, len(r.channels))
	for key := range r.channels {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	items := make([]ServiceManifestItem, 0, len(keys))
	for _, key := range keys {
		record := r.channels[key]
		items = append(items, ServiceManifestItem{
			Name:        record.name,
			Description: record.description,
		})
	}
	return items, nil
}

func (r *ChannelRegistry) ApplySync(result SyncServicesResult) ([]BrokerServiceTarget, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	targets := make([]BrokerServiceTarget, 0, len(result.Items))
	for _, item := range result.Items {
		name := strings.TrimSpace(item.Name)
		edgeServiceID := strings.TrimSpace(item.EdgeServiceID)
		if name == "" || edgeServiceID == "" {
			return nil, errors.New("sync result item requires name and edge service id")
		}
		record, ok := r.channels[name]
		if !ok {
			return nil, fmt.Errorf("sync result references unregistered service name=%s", name)
		}
		if strings.TrimSpace(item.Status) != "active" {
			continue
		}
		targets = append(targets, BrokerServiceTarget{
			EdgeServiceID: edgeServiceID,
			Name:          name,
			TargetHost:    record.targetHost,
			TargetPort:    record.targetPort,
		})
	}
	return targets, nil
}

func newChannelRecord(spec ChannelSpec) (*channelRecord, error) {
	name := strings.TrimSpace(spec.Name)
	if name == "" {
		return nil, errors.New("service name is required")
	}
	host, port, err := splitTCPHostPort(spec.Target)
	if err != nil {
		return nil, fmt.Errorf("service name=%s target: %w", name, err)
	}
	return &channelRecord{
		name:        name,
		description: strings.TrimSpace(spec.Description),
		targetHost:  host,
		targetPort:  port,
	}, nil
}
