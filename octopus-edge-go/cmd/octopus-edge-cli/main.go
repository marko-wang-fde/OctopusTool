package main

import (
	"context"
	"crypto/tls"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/syngy-ai/octopus-edge-go/octopusedge"
)

const version = "dev"

var embeddedBrokerRunner = func(ctx context.Context, broker *octopusedge.Broker) error {
	return broker.Run(ctx)
}

func main() {
	os.Exit(Run(context.Background(), os.Args[1:], os.Stdout, os.Stderr))
}

func Run(ctx context.Context, args []string, stdout io.Writer, stderr io.Writer) int {
	if len(args) == 0 {
		printUsage(stdout)
		return 0
	}
	switch args[0] {
	case "auth":
		return runAuth(ctx, args[1:], stdout, stderr)
	case "start":
		return runStart(ctx, args[1:], stdout, stderr)
	case "version":
		fmt.Fprintf(stdout, "octopus-edge-cli %s\n", version)
		return 0
	case "help", "-h", "--help":
		printUsage(stdout)
		return 0
	default:
		fmt.Fprintf(stderr, "unknown command: %s\n", args[0])
		printUsage(stderr)
		return 2
	}
}

func runAuth(ctx context.Context, args []string, stdout io.Writer, stderr io.Writer) int {
	fs := flag.NewFlagSet("auth", flag.ContinueOnError)
	fs.SetOutput(stderr)
	account := fs.String("account", "", "Account base URL")
	host := fs.String("host", "", "Host base URL")
	name := fs.String("name", "", "broker display name")
	profilePath := fs.String("profile", "", "profile path")
	noWait := fs.Bool("no-wait", false, "create authorization request without polling")
	pollInterval := fs.Duration("poll-interval", 2*time.Second, "poll interval")
	timeout := fs.Duration("timeout", 10*time.Minute, "authorization timeout")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if *account == "" {
		fmt.Fprintln(stderr, "--account is required")
		return 2
	}
	if *host == "" {
		fmt.Fprintln(stderr, "--host is required")
		return 2
	}
	if *name == "" {
		fmt.Fprintln(stderr, "--name is required")
		return 2
	}
	path, err := resolveProfilePath(*profilePath)
	if err != nil {
		fmt.Fprintf(stderr, "resolve profile path: %v\n", err)
		return 1
	}
	store := octopusedge.FileProfileStore{Path: path}
	clientID, err := store.LoadOrNewClientID()
	if err != nil {
		fmt.Fprintf(stderr, "load client id: %v\n", err)
		return 1
	}
	client, err := octopusedge.NewJCodeClient(*account, *host)
	if err != nil {
		fmt.Fprintf(stderr, "create jcode client: %v\n", err)
		return 2
	}
	session, err := client.CreateJCodeSession(ctx, octopusedge.CreateJCodeSessionInput{
		ClientID:   clientID,
		ClientType: octopusedge.TeamDeviceClientTypeOctopusEdgeBroker,
		DeviceName: *name,
	})
	if err != nil {
		fmt.Fprintf(stderr, "create authorization request: %v\n", err)
		return 1
	}
	fmt.Fprintf(stdout, "8 digits: %s\n", session.JCode)
	if session.LoginURL != "" {
		fmt.Fprintf(stdout, "approval url: %s\n", session.LoginURL)
	}
	fmt.Fprintf(stdout, "handoff id: %s\n", session.HandoffID)
	if *noWait {
		return 0
	}

	waitCtx, cancel := context.WithTimeout(ctx, *timeout)
	defer cancel()
	credentials, err := client.WaitForDeviceCredentials(waitCtx, session.HandoffID, session.JCode, *pollInterval)
	if err != nil {
		fmt.Fprintf(stderr, "wait device credentials: %v\n", err)
		return 1
	}
	if credentials.BrokerInstanceID == "" || credentials.BindingCredential == "" {
		fmt.Fprintln(stderr, "authorization result did not include broker identity")
		return 1
	}
	profile := octopusedge.Profile{
		Host:                  client.HostBaseURL(),
		Account:               client.AccountBaseURL(),
		ClientID:              clientID,
		ClientType:            octopusedge.TeamDeviceClientTypeOctopusEdgeBroker,
		DeviceName:            *name,
		TeamID:                credentials.TeamID,
		TeamDeviceID:          credentials.TeamDeviceID,
		BrokerInstanceID:      credentials.BrokerInstanceID,
		BindingCredential:     credentials.BindingCredential,
		AccessToken:           credentials.AccessToken,
		AccessTokenExpiresAt:  credentials.AccessTokenExpiresAt,
		RefreshToken:          credentials.RefreshToken,
		RefreshTokenExpiresAt: credentials.RefreshTokenExpiresAt,
		BoundAt:               credentials.BoundAt,
	}
	if err := store.Save(profile); err != nil {
		fmt.Fprintf(stderr, "save profile: %v\n", err)
		return 1
	}
	fmt.Fprintf(stdout, "authenticated team=%s teamDevice=%s\n", credentials.TeamID, credentials.TeamDeviceID)
	return 0
}

func runStart(ctx context.Context, args []string, stdout io.Writer, stderr io.Writer) int {
	fs := flag.NewFlagSet("start", flag.ContinueOnError)
	fs.SetOutput(stderr)
	configPath := fs.String("c", "", "config file")
	profilePath := fs.String("profile", "", "profile path")
	insecureSkipServerVerification := fs.Bool("insecure-skip-server-verification", false, "smoke only: skip broker TLS server verification")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if *configPath == "" {
		fmt.Fprintln(stderr, "-c is required")
		return 2
	}
	path, err := resolveProfilePath(*profilePath)
	if err != nil {
		fmt.Fprintf(stderr, "resolve profile path: %v\n", err)
		return 1
	}
	store := octopusedge.FileProfileStore{Path: path}
	profile, err := store.Load()
	if err != nil {
		fmt.Fprintf(stderr, "load profile: %v\n", err)
		return 1
	}
	if err := profile.ValidateForStart(); err != nil {
		fmt.Fprintf(stderr, "validate profile: %v\n", err)
		return 1
	}
	cfg, err := octopusedge.LoadConfig(*configPath)
	if err != nil {
		fmt.Fprintf(stderr, "load config: %v\n", err)
		return 1
	}
	client, err := octopusedge.NewJCodeClient(profile.Account, profile.Host)
	if err != nil {
		fmt.Fprintf(stderr, "create host client: %v\n", err)
		return 1
	}
	if strings.TrimSpace(profile.AccessToken) == "" || profile.AccessTokenExpiresAt.Before(time.Now().Add(time.Minute)) {
		fmt.Fprintln(stderr, "device access token expired; run auth again")
		return 1
	}
	fmt.Fprintf(stdout, "validated %d service(s) for teamDevice=%s\n", len(cfg.Services), profile.TeamDeviceID)
	dialer := octopusedge.QUICGatewayDialer{}
	if *insecureSkipServerVerification {
		dialer.TLSConfig = &tls.Config{InsecureSkipVerify: true}
	}
	err = embeddedBrokerRunner(ctx, &octopusedge.Broker{
		Profile:       profile,
		Services:      cfg.ChannelSpecs(),
		Client:        client,
		BrokerVersion: version,
		Dialer:        dialer,
		Status: func(status octopusedge.BrokerStatus) {
			if status.LastError != "" {
				fmt.Fprintf(stderr, "octopus-edge %s: %s\n", status.State, status.LastError)
			}
			if status.Running {
				fmt.Fprintf(stdout, "octopus-edge online connection=%s endpointVersion=%d\n", status.ConnectionID, status.EndpointVersion)
			}
		},
		ProfileUpdated: func(profile octopusedge.Profile) {
			if err := store.Save(profile); err != nil {
				fmt.Fprintf(stderr, "save refreshed profile: %v\n", err)
			}
		},
	})
	if err != nil && ctx.Err() == nil {
		fmt.Fprintf(stderr, "run embedded broker: %v\n", err)
		return 1
	}
	return 0
}

func resolveProfilePath(path string) (string, error) {
	if path != "" {
		return path, nil
	}
	return octopusedge.DefaultProfilePath()
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func printUsage(w io.Writer) {
	fmt.Fprintln(w, "usage: octopus-edge-cli <auth|start|version>")
}
