/* eslint-disable */
/* tslint:disable */
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

import { unwrapPinResponse } from './unwrap-pin-response.js';

export interface BaseConnectorConfigListResponse {
  items?: BaseConnectorConfigRecord[];
}

export interface BaseConnectorConfigRecord {
  description?: string;
  env_config?: BaseJSONMap;
  icon_url?: string;
  id?: string;
  name?: string;
  oauth_callback_url?: string;
  pkg_id?: string;
  secret_config?: Record<string, boolean>;
  status?: string;
  updated_at?: string;
  version?: string;
  visibility?: string;
}

export interface BaseConnectorConfigUpdateRequest {
  description?: string;
  env_config?: BaseJSONMap;
  name?: string;
  secret_config?: BaseJSONMap;
  version?: string;
  visibility?: string;
}

export interface BaseConnectorRegistryDeployRequest {
  instance_id?: string;
  name?: string;
  version?: string;
}

export interface BaseConnectorRegistryDeployResponse {
  available_instances?: BaseConnectorRegistryDeployTarget[];
  instance_id?: string;
  instance_name?: string;
  message?: string;
  needs_selection?: boolean;
  version?: string;
}

export interface BaseConnectorRegistryDeployTarget {
  description?: string;
  env_config?: BaseJSONMap;
  icon_url?: string;
  id?: string;
  name?: string;
  pkg_id?: string;
  status?: string;
  updated_at?: string;
  version?: string;
  visibility?: string;
}

export interface BaseConnectorRegistryPackage {
  created_at?: string;
  description?: string;
  hash_id?: string;
  icon_url?: string;
  id?: string;
  latest_version?: string;
  name?: string;
  tools_count?: number;
  updated_at?: string;
}

export interface BaseConnectorRegistryPublishRequest {
  name?: string;
}

export interface BaseConnectorRegistryUploadURLRequest {
  files?: string[];
  name?: string;
}

export interface BaseConnectorRegistryUploadURLResponse {
  upload_urls?: Record<string, string>;
}

export interface BaseConnectorRegistryVersion {
  authType?: string;
  bundleSize?: number;
  bundleURL?: string;
  createdAt?: string;
  iconURL?: string;
  id?: number;
  manifest?: string;
  releaseNote?: string;
  toolCount?: number;
  uploadedBy?: number;
  version?: string;
}

export type BaseJSONMap = Record<string, any>;

export interface BasePinErr {
  error?: any;
  trace_id?: string;
}

export interface BasePinOKArrayBaseConnectorRegistryPackage {
  data?: BaseConnectorRegistryPackage[];
  trace_id?: string;
}

export interface BasePinOKArrayBaseConnectorRegistryVersion {
  data?: BaseConnectorRegistryVersion[];
  trace_id?: string;
}

export interface BasePinOKArrayBaseRemoteTaskConnectorInstance {
  data?: BaseRemoteTaskConnectorInstance[];
  trace_id?: string;
}

export interface BasePinOKArrayBaseRemoteTaskPackageVersion {
  data?: BaseRemoteTaskPackageVersion[];
  trace_id?: string;
}

export interface BasePinOKBaseConnectorConfigListResponse {
  data?: BaseConnectorConfigListResponse;
  trace_id?: string;
}

export interface BasePinOKBaseConnectorConfigRecord {
  data?: BaseConnectorConfigRecord;
  trace_id?: string;
}

export interface BasePinOKBaseConnectorRegistryDeployResponse {
  data?: BaseConnectorRegistryDeployResponse;
  trace_id?: string;
}

export interface BasePinOKBaseConnectorRegistryUploadURLResponse {
  data?: BaseConnectorRegistryUploadURLResponse;
  trace_id?: string;
}

export interface BasePinOKBaseJSONMap {
  data?: BaseJSONMap;
  trace_id?: string;
}

export interface BasePinOKBaseRemoteTaskCancelResponse {
  data?: BaseRemoteTaskCancelResponse;
  trace_id?: string;
}

export interface BasePinOKBaseRemoteTaskConnection {
  data?: BaseRemoteTaskConnection;
  trace_id?: string;
}

export interface BasePinOKBaseRemoteTaskConnectionActionDetail {
  data?: BaseRemoteTaskConnectionActionDetail;
  trace_id?: string;
}

export interface BasePinOKBaseRemoteTaskConnectionListResponse {
  data?: BaseRemoteTaskConnectionListResponse;
  trace_id?: string;
}

export interface BasePinOKBaseRemoteTaskConnector {
  data?: BaseRemoteTaskConnector;
  trace_id?: string;
}

export interface BasePinOKBaseRemoteTaskConnectorInstance {
  data?: BaseRemoteTaskConnectorInstance;
  trace_id?: string;
}

export interface BasePinOKBaseRemoteTaskConnectorListResponse {
  data?: BaseRemoteTaskConnectorListResponse;
  trace_id?: string;
}

export interface BasePinOKBaseRemoteTaskConnectorPackageDetail {
  data?: BaseRemoteTaskConnectorPackageDetail;
  trace_id?: string;
}

export interface BasePinOKBaseRemoteTaskConnectorPackageListResponse {
  data?: BaseRemoteTaskConnectorPackageListResponse;
  trace_id?: string;
}

export interface BasePinOKBaseRemoteTaskExecuteActionResponse {
  data?: BaseRemoteTaskExecuteActionResponse;
  trace_id?: string;
}

export interface BasePinOKBaseRemoteTaskExecution {
  data?: BaseRemoteTaskExecution;
  trace_id?: string;
}

export interface BasePinOKBaseRemoteTaskExecutionListResponse {
  data?: BaseRemoteTaskExecutionListResponse;
  trace_id?: string;
}

export interface BasePinOKBaseRemoteTaskStartAuthResponse {
  data?: BaseRemoteTaskStartAuthResponse;
  trace_id?: string;
}

export interface BasePinOKMapStringString {
  data?: MapStringString;
  trace_id?: string;
}

export interface BasePinOKServicesMcplinxVisibleProofRecord {
  data?: ServicesMcplinxVisibleProofRecord;
  trace_id?: string;
}

export interface BasePinOKVoActResponse {
  data?: VoActResponse;
  trace_id?: string;
}

export interface BasePinOKVoAdminAssistantEnsureResponse {
  data?: VoAdminAssistantEnsureResponse;
  trace_id?: string;
}

export interface BasePinOKVoAdminBatchUpsertComputeImagesResponse {
  data?: VoAdminBatchUpsertComputeImagesResponse;
  trace_id?: string;
}

export interface BasePinOKVoAdminBatchUpsertLLMModelsResponse {
  data?: VoAdminBatchUpsertLLMModelsResponse;
  trace_id?: string;
}

export interface BasePinOKVoAdminComputeImageItem {
  data?: VoAdminComputeImageItem;
  trace_id?: string;
}

export interface BasePinOKVoAdminDigiEmployee {
  data?: VoAdminDigiEmployee;
  trace_id?: string;
}

export interface BasePinOKVoAdminDigiEmployeeDetail {
  data?: VoAdminDigiEmployeeDetail;
  trace_id?: string;
}

export interface BasePinOKVoAdminDigiWorker {
  data?: VoAdminDigiWorker;
  trace_id?: string;
}

export interface BasePinOKVoAdminDigiWorkerSeed {
  data?: VoAdminDigiWorkerSeed;
  trace_id?: string;
}

export interface BasePinOKVoAdminDigiWorkerSeedPreviewResponse {
  data?: VoAdminDigiWorkerSeedPreviewResponse;
  trace_id?: string;
}

export interface BasePinOKVoAdminLLMModelItem {
  data?: VoAdminLLMModelItem;
  trace_id?: string;
}

export interface BasePinOKVoAdminOctopusClusterItem {
  data?: VoAdminOctopusClusterItem;
  trace_id?: string;
}

export interface BasePinOKVoAdminPresignPrivateStorageResponse {
  data?: VoAdminPresignPrivateStorageResponse;
  trace_id?: string;
}

export interface BasePinOKVoAdminScanSkillsResponse {
  data?: VoAdminScanSkillsResponse;
  trace_id?: string;
}

export interface BasePinOKVoAdminSkill {
  data?: VoAdminSkill;
  trace_id?: string;
}

export interface BasePinOKVoArtifactDetail {
  data?: VoArtifactDetail;
  trace_id?: string;
}

export interface BasePinOKVoArtifactDownloadURLResponse {
  data?: VoArtifactDownloadURLResponse;
  trace_id?: string;
}

export interface BasePinOKVoArtifactSummaryResponse {
  data?: VoArtifactSummaryResponse;
  trace_id?: string;
}

export interface BasePinOKVoCase {
  data?: VoCase;
  trace_id?: string;
}

export interface BasePinOKVoConnectionAuthTaskCreateResponse {
  data?: VoConnectionAuthTaskCreateResponse;
  trace_id?: string;
}

export interface BasePinOKVoConnectionAuthTaskDetailResponse {
  data?: VoConnectionAuthTaskDetailResponse;
  trace_id?: string;
}

export interface BasePinOKVoContentResponse {
  data?: VoContentResponse;
  trace_id?: string;
}

export interface BasePinOKVoConversationAssistant {
  data?: VoConversationAssistant;
  trace_id?: string;
}

export interface BasePinOKVoConversationDesktopCurrent {
  data?: VoConversationDesktopCurrent;
  trace_id?: string;
}

export interface BasePinOKVoConversationFileGrantsResponse {
  data?: VoConversationFileGrantsResponse;
  trace_id?: string;
}

export interface BasePinOKVoConversationMeta {
  data?: VoConversationMeta;
  trace_id?: string;
}

export interface BasePinOKVoConversationTempUploadAuthorizeResponse {
  data?: VoConversationTempUploadAuthorizeResponse;
  trace_id?: string;
}

export interface BasePinOKVoConversationTempUploadFinalizeResponse {
  data?: VoConversationTempUploadFinalizeResponse;
  trace_id?: string;
}

export interface BasePinOKVoConversationTurnLLMTraceCallDetail {
  data?: VoConversationTurnLLMTraceCallDetail;
  trace_id?: string;
}

export interface BasePinOKVoCronTrigger {
  data?: VoCronTrigger;
  trace_id?: string;
}

export interface BasePinOKVoCronTriggerRun {
  data?: VoCronTriggerRun;
  trace_id?: string;
}

export interface BasePinOKVoDeleteExternalUserVerificationFlowResponse {
  data?: VoDeleteExternalUserVerificationFlowResponse;
  trace_id?: string;
}

export interface BasePinOKVoDigiEmployee {
  data?: VoDigiEmployee;
  trace_id?: string;
}

export interface BasePinOKVoDigiEmployeeKBAccess {
  data?: VoDigiEmployeeKBAccess;
  trace_id?: string;
}

export interface BasePinOKVoEndpointTypeConfigSchemaResponse {
  data?: VoEndpointTypeConfigSchemaResponse;
  trace_id?: string;
}

export interface BasePinOKVoExternalUserDetail {
  data?: VoExternalUserDetail;
  trace_id?: string;
}

export interface BasePinOKVoExternalUserVerificationFlowDetail {
  data?: VoExternalUserVerificationFlowDetail;
  trace_id?: string;
}

export interface BasePinOKVoFileNode {
  data?: VoFileNode;
  trace_id?: string;
}

export interface BasePinOKVoGetDigiEmployeeTeamSkillsResponse {
  data?: VoGetDigiEmployeeTeamSkillsResponse;
  trace_id?: string;
}

export interface BasePinOKVoInboxSummary {
  data?: VoInboxSummary;
  trace_id?: string;
}

export interface BasePinOKVoJob {
  data?: VoJob;
  trace_id?: string;
}

export interface BasePinOKVoJobTagItem {
  data?: VoJobTagItem;
  trace_id?: string;
}

export interface BasePinOKVoLinktoolConnectionsRuntimeResponse {
  data?: VoLinktoolConnectionsRuntimeResponse;
  trace_id?: string;
}

export interface BasePinOKVoLinktoolLoginCodeExchangeResponse {
  data?: VoLinktoolLoginCodeExchangeResponse;
  trace_id?: string;
}

export interface BasePinOKVoLinktoolLoginCodeIssueResponse {
  data?: VoLinktoolLoginCodeIssueResponse;
  trace_id?: string;
}

export interface BasePinOKVoLinktoolLoginSessionCreateResponse {
  data?: VoLinktoolLoginSessionCreateResponse;
  trace_id?: string;
}

export interface BasePinOKVoLinktoolLoginSessionDetailResponse {
  data?: VoLinktoolLoginSessionDetailResponse;
  trace_id?: string;
}

export interface BasePinOKVoLinktoolPublishRuntimeResponse {
  data?: VoLinktoolPublishRuntimeResponse;
  trace_id?: string;
}

export interface BasePinOKVoLinktoolTestAuthRuntimeResponse {
  data?: VoLinktoolTestAuthRuntimeResponse;
  trace_id?: string;
}

export interface BasePinOKVoLinktoolTunnelSessionRuntimeResponse {
  data?: VoLinktoolTunnelSessionRuntimeResponse;
  trace_id?: string;
}

export interface BasePinOKVoListAdminAuditLogsResponse {
  data?: VoListAdminAuditLogsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListAdminComputeImageTeamBindingsResponse {
  data?: VoListAdminComputeImageTeamBindingsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListAdminComputeImagesResponse {
  data?: VoListAdminComputeImagesResponse;
  trace_id?: string;
}

export interface BasePinOKVoListAdminDigiEmployeesResponse {
  data?: VoListAdminDigiEmployeesResponse;
  trace_id?: string;
}

export interface BasePinOKVoListAdminDigiWorkerSeedsResponse {
  data?: VoListAdminDigiWorkerSeedsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListAdminDigiWorkersResponse {
  data?: VoListAdminDigiWorkersResponse;
  trace_id?: string;
}

export interface BasePinOKVoListAdminLLMModelsResponse {
  data?: VoListAdminLLMModelsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListAdminOctopusClustersResponse {
  data?: VoListAdminOctopusClustersResponse;
  trace_id?: string;
}

export interface BasePinOKVoListAdminPrivateStorageObjectsResponse {
  data?: VoListAdminPrivateStorageObjectsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListAdminSkillsResponse {
  data?: VoListAdminSkillsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListAdminStorageEntriesResponse {
  data?: VoListAdminStorageEntriesResponse;
  trace_id?: string;
}

export interface BasePinOKVoListArtifactsResponse {
  data?: VoListArtifactsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListCasesResponse {
  data?: VoListCasesResponse;
  trace_id?: string;
}

export interface BasePinOKVoListConversationDesktopSnapshotsResponse {
  data?: VoListConversationDesktopSnapshotsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListConversationRuntimeItemsResponse {
  data?: VoListConversationRuntimeItemsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListConversationTurnLLMTraceResponse {
  data?: VoListConversationTurnLLMTraceResponse;
  trace_id?: string;
}

export interface BasePinOKVoListCronTriggerRunsResponse {
  data?: VoListCronTriggerRunsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListCronTriggersResponse {
  data?: VoListCronTriggersResponse;
  trace_id?: string;
}

export interface BasePinOKVoListDigiEmployeesResponse {
  data?: VoListDigiEmployeesResponse;
  trace_id?: string;
}

export interface BasePinOKVoListEndpointTypesResponse {
  data?: VoListEndpointTypesResponse;
  trace_id?: string;
}

export interface BasePinOKVoListExternalUserConversationsResponse {
  data?: VoListExternalUserConversationsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListExternalUserVerificationFlowsResponse {
  data?: VoListExternalUserVerificationFlowsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListExternalUsersResponse {
  data?: VoListExternalUsersResponse;
  trace_id?: string;
}

export interface BasePinOKVoListIntegrationsResponse {
  data?: VoListIntegrationsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListJobsResponse {
  data?: VoListJobsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListMarketDigiWorkersResponse {
  data?: VoListMarketDigiWorkersResponse;
  trace_id?: string;
}

export interface BasePinOKVoListPinnedDigiEmployeesResponse {
  data?: VoListPinnedDigiEmployeesResponse;
  trace_id?: string;
}

export interface BasePinOKVoListRecentsResponse {
  data?: VoListRecentsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListReportingNeighborsResponse {
  data?: VoListReportingNeighborsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListSelectableJobTagsResponse {
  data?: VoListSelectableJobTagsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListSiteConfigResponse {
  data?: VoListSiteConfigResponse;
  trace_id?: string;
}

export interface BasePinOKVoListSkillsetsResponse {
  data?: VoListSkillsetsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListStationApiKeysResponse {
  data?: VoListStationApiKeysResponse;
  trace_id?: string;
}

export interface BasePinOKVoListStationsResponse {
  data?: VoListStationsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListTeamComputeImagesResponse {
  data?: VoListTeamComputeImagesResponse;
  trace_id?: string;
}

export interface BasePinOKVoListTeamDevicesResponse {
  data?: VoListTeamDevicesResponse;
  trace_id?: string;
}

export interface BasePinOKVoListTeamExternalUserTagsResponse {
  data?: VoListTeamExternalUserTagsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListTeamKbDirectoriesResponse {
  data?: VoListTeamKbDirectoriesResponse;
  trace_id?: string;
}

export interface BasePinOKVoListTeamKbSyncBindingsResponse {
  data?: VoListTeamKbSyncBindingsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListTeamKbSyncJobsResponse {
  data?: VoListTeamKbSyncJobsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListTeamMcpTunnelBindingsResponse {
  data?: VoListTeamMcpTunnelBindingsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListTeamMcpTunnelsResponse {
  data?: VoListTeamMcpTunnelsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListTeamMembersResponse {
  data?: VoListTeamMembersResponse;
  trace_id?: string;
}

export interface BasePinOKVoListTeamStorageEntriesResponse {
  data?: VoListTeamStorageEntriesResponse;
  trace_id?: string;
}

export interface BasePinOKVoListTeamStorageMountsResponse {
  data?: VoListTeamStorageMountsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListTeamsResponse {
  data?: VoListTeamsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListTenantAdminDigiWorkersResponse {
  data?: VoListTenantAdminDigiWorkersResponse;
  trace_id?: string;
}

export interface BasePinOKVoListTenantAdminJobTagsResponse {
  data?: VoListTenantAdminJobTagsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListTenantAdminLLMModelsResponse {
  data?: VoListTenantAdminLLMModelsResponse;
  trace_id?: string;
}

export interface BasePinOKVoListWecomContactsResponse {
  data?: VoListWecomContactsResponse;
  trace_id?: string;
}

export interface BasePinOKVoMeResponse {
  data?: VoMeResponse;
  trace_id?: string;
}

export interface BasePinOKVoPortalBrand {
  data?: VoPortalBrand;
  trace_id?: string;
}

export interface BasePinOKVoPortalBrandAssetUploadResponse {
  data?: VoPortalBrandAssetUploadResponse;
  trace_id?: string;
}

export interface BasePinOKVoPortalBrandResolution {
  data?: VoPortalBrandResolution;
  trace_id?: string;
}

export interface BasePinOKVoPostConversationHumanTurnResponse {
  data?: VoPostConversationHumanTurnResponse;
  trace_id?: string;
}

export interface BasePinOKVoRemoteTaskDeleteResponse {
  data?: VoRemoteTaskDeleteResponse;
  trace_id?: string;
}

export interface BasePinOKVoRotateStationApiKeyResponse {
  data?: VoRotateStationApiKeyResponse;
  trace_id?: string;
}

export interface BasePinOKVoSimpleOKResponse {
  data?: VoSimpleOKResponse;
  trace_id?: string;
}

export interface BasePinOKVoSiteConfigItem {
  data?: VoSiteConfigItem;
  trace_id?: string;
}

export interface BasePinOKVoSkillset {
  data?: VoSkillset;
  trace_id?: string;
}

export interface BasePinOKVoStation {
  data?: VoStation;
  trace_id?: string;
}

export interface BasePinOKVoStationResponsesResult {
  data?: VoStationResponsesResult;
  trace_id?: string;
}

export interface BasePinOKVoTeam {
  data?: VoTeam;
  trace_id?: string;
}

export interface BasePinOKVoTeamBillingSummaryResponse {
  data?: VoTeamBillingSummaryResponse;
  trace_id?: string;
}

export interface BasePinOKVoTeamDevice {
  data?: VoTeamDevice;
  trace_id?: string;
}

export interface BasePinOKVoTeamIntegrationVO {
  data?: VoTeamIntegrationVO;
  trace_id?: string;
}

export interface BasePinOKVoTeamKbDirectory {
  data?: VoTeamKbDirectory;
  trace_id?: string;
}

export interface BasePinOKVoTeamKbSyncBinding {
  data?: VoTeamKbSyncBinding;
  trace_id?: string;
}

export interface BasePinOKVoTeamKbSyncBootstrapAccessResponse {
  data?: VoTeamKbSyncBootstrapAccessResponse;
  trace_id?: string;
}

export interface BasePinOKVoTeamMcpTunnel {
  data?: VoTeamMcpTunnel;
  trace_id?: string;
}

export interface BasePinOKVoTeamMembershipProfile {
  data?: VoTeamMembershipProfile;
  trace_id?: string;
}

export interface BasePinOKVoTeamPresignResponse {
  data?: VoTeamPresignResponse;
  trace_id?: string;
}

export interface BasePinOKVoTeamUploadFinalizeResponse {
  data?: VoTeamUploadFinalizeResponse;
  trace_id?: string;
}

export interface BasePinOKVoTenantAdminAssistantEnsureResponse {
  data?: VoTenantAdminAssistantEnsureResponse;
  trace_id?: string;
}

export interface BasePinOKVoTenantAdminDigiEmployeeDetail {
  data?: VoTenantAdminDigiEmployeeDetail;
  trace_id?: string;
}

export interface BasePinOKVoTenantAdminDigiWorker {
  data?: VoTenantAdminDigiWorker;
  trace_id?: string;
}

export interface BasePinOKVoTenantAdminDigiWorkerAutoCreateThresholdResponse {
  data?: VoTenantAdminDigiWorkerAutoCreateThresholdResponse;
  trace_id?: string;
}

export interface BasePinOKVoTenantAdminDigiworkerDebugConfig {
  data?: VoTenantAdminDigiworkerDebugConfig;
  trace_id?: string;
}

export interface BasePinOKVoTenantAdminSettlementConfig {
  data?: VoTenantAdminSettlementConfig;
  trace_id?: string;
}

export interface BasePinOKVoValidateTeamKbSyncTargetResponse {
  data?: VoValidateTeamKbSyncTargetResponse;
  trace_id?: string;
}

export interface BasePinOKVoVerifyFeishuResponse {
  data?: VoVerifyFeishuResponse;
  trace_id?: string;
}

export interface BasePinOKVoVerifyWecomResponse {
  data?: VoVerifyWecomResponse;
  trace_id?: string;
}

export interface BaseRemoteTaskAuthField {
  helpText?: string;
  key?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}

export interface BaseRemoteTaskCancelResponse {
  execution_id?: string;
  status?: string;
}

export interface BaseRemoteTaskConnection {
  auth_scopes?: string[];
  auth_type?: string;
  connector_id?: string;
  created_at?: string;
  id?: string;
  label?: string;
  last_used_at?: string;
  package?: BaseRemoteTaskConnectorPackage;
  required_scopes?: string[];
  requires_reauth?: boolean;
  resolution_hint?: string;
  status?: string;
  token_expires_at?: string;
  updated_at?: string;
}

export interface BaseRemoteTaskConnectionActionDetail {
  description?: string;
  input_schema?: BaseJSONMap;
  key?: string;
  kind?: string;
  name?: string;
}

export interface BaseRemoteTaskConnectionListResponse {
  connections?: BaseRemoteTaskConnection[];
}

export interface BaseRemoteTaskConnector {
  created_at?: string;
  download_url?: string;
  error_message?: string;
  id?: string;
  instance_description?: string;
  name?: string;
  package?: BaseRemoteTaskConnectorPackage;
  relevance?: number;
  tool_count?: number;
  updated_at?: string;
  version?: string;
}

export interface BaseRemoteTaskConnectorInstance {
  activePkgVersionID?: number;
  activeVersion?: string;
  createdAt?: string;
  embeddingSyncedVersion?: string;
  envConfig?: BaseJSONMap;
  id?: number;
  instance_description?: string;
  name?: string;
  oauthCallbackURL?: string;
  ownerID?: number;
  pkg_id?: string;
  secretConfig?: Record<string, boolean>;
  status?: string;
  updatedAt?: string;
  versions?: BaseRemoteTaskPackageVersion[];
  visibility?: string;
}

export interface BaseRemoteTaskConnectorListResponse {
  connectors?: BaseRemoteTaskConnector[];
}

export interface BaseRemoteTaskConnectorPackage {
  icon_url?: string;
  id?: string;
  name?: string;
  package_description?: string;
}

export interface BaseRemoteTaskConnectorPackageDetail {
  activeInstances?: number;
  author?: BaseRemoteTaskPackageAuthor;
  authorID?: number;
  createdAt?: string;
  hashID?: string;
  iconUpdatedAt?: string;
  icon_url?: string;
  id?: string;
  name?: string;
  package_description?: string;
  pendingReviews?: number;
  publicInstances?: number;
  source_id?: string;
  totalInstances?: number;
  updatedAt?: string;
  versions?: BaseRemoteTaskPackageVersion[];
}

export interface BaseRemoteTaskConnectorPackageListResponse {
  items?: BaseRemoteTaskConnectorPackageDetail[];
}

export interface BaseRemoteTaskCreateConnectionRequest {
  connector_id?: string;
  label?: string;
}

export interface BaseRemoteTaskCreateInstanceRequest {
  active_version?: string;
  description?: string;
  env_config?: BaseJSONMap;
  name?: string;
  pkg_id?: string;
  secret_config?: BaseJSONMap;
  visibility?: string;
}

export interface BaseRemoteTaskExecuteActionResponse {
  duration?: number;
  executed_at?: string;
  execution_id?: string;
  kind?: string;
  message?: string;
  result?: BaseJSONMap;
  status?: string;
  success?: boolean;
  task_id?: string;
  webhook_supported?: boolean;
}

export interface BaseRemoteTaskExecution {
  action_description?: string;
  action_key?: string;
  action_name?: string;
  connection_id?: string;
  created_at?: string;
  error?: BaseJSONMap;
  external_task_id?: string;
  finished_at?: string;
  id?: string;
  input?: BaseJSONMap;
  kind?: string;
  package?: BaseRemoteTaskConnectorPackage;
  result?: BaseJSONMap;
  started_at?: string;
  status?: string;
  task_info_url?: string;
  webhook_supported?: boolean;
}

export interface BaseRemoteTaskExecutionListResponse {
  executions?: BaseRemoteTaskExecution[];
  limit?: number;
  offset?: number;
  total?: number;
}

export interface BaseRemoteTaskPackageAuthor {
  email?: string;
  id?: number;
  name?: string;
}

export interface BaseRemoteTaskPackageVersion {
  authType?: string;
  bundleSize?: number;
  bundleURL?: string;
  createdAt?: string;
  iconURL?: string;
  id?: number;
  manifest?: string;
  releaseNote?: string;
  toolCount?: number;
  uploadedBy?: number;
  version?: string;
}

export interface BaseRemoteTaskReviewInstanceRequest {
  action?: string;
  env_config?: BaseJSONMap;
  reason?: string;
}

export interface BaseRemoteTaskStartAuthResponse {
  connection_label?: string;
  fields?: BaseRemoteTaskAuthField[];
  type?: string;
  url?: string;
}

export interface E2EProofSendRequest {
  externalUserId?: string;
  message?: string;
  proofId?: string;
  query?: string;
  stationId?: string;
  tag?: string;
}

export interface LinktoolLoginAuthCompleteSessionRequest {
  teamId?: string;
}

export type MapStringString = Record<string, string>;

export interface ModelsPromptSpec {
  script?: string;
  text?: string;
  type?: string;
}

export interface RuntimesnapshotHostLLMUsage {
  cachedTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
}

export interface ServicesMcplinxVisibleProofEvent {
  at?: string;
  detail?: Record<string, any>;
  step?: string;
}

export interface ServicesMcplinxVisibleProofRecord {
  events?: ServicesMcplinxVisibleProofEvent[];
  externalUserId?: string;
  message?: string;
  proofId?: string;
  stationId?: string;
  status?: string;
  tag?: string;
  updatedAt?: string;
}

export interface VoActRequest {
  action?: string;
}

export interface VoActResponse {
  item?: VoInboxItem;
}

export interface VoAdminAssistantEnsureRequest {
  digiWorkerId: string;
}

export interface VoAdminAssistantEnsureResponse {
  digiEmployeeId?: string;
}

export interface VoAdminAuditLog {
  action?: string;
  actorUserId?: string;
  createdAt?: string;
  id?: string;
  payload?: number[];
  reason?: string;
  resourceId?: string;
  resourceType?: string;
}

export interface VoAdminBatchDeleteComputeImageTeamBindingsRequest {
  teamIds: string[];
}

export interface VoAdminBatchDeleteLLMModelsRequest {
  ids: string[];
}

export interface VoAdminBatchUpsertComputeImageTeamBindingsRequest {
  teamIds: string[];
}

export interface VoAdminBatchUpsertComputeImagesItem {
  cpu: number;
  description?: string;
  enabled?: boolean;
  name: string;
  osType?: string;
  providerImageId: string;
  visibility: string;
}

export interface VoAdminBatchUpsertComputeImagesRequest {
  items: VoAdminBatchUpsertComputeImagesItem[];
}

export interface VoAdminBatchUpsertComputeImagesResponse {
  items?: VoAdminComputeImageItem[];
}

export interface VoAdminBatchUpsertLLMModelsItem {
  cacheReadCost?: number;
  inputCost?: number;
  model: string;
  modelExternalName: string;
  name: string;
  outputCost?: number;
  provider: string;
  providerName: string;
  reasoningEffort?: string;
}

export interface VoAdminBatchUpsertLLMModelsRequest {
  items: VoAdminBatchUpsertLLMModelsItem[];
}

export interface VoAdminBatchUpsertLLMModelsResponse {
  items?: VoAdminLLMModelItem[];
}

export interface VoAdminComputeImageItem {
  cpu?: number;
  createdAt?: string;
  description?: string;
  enabled?: boolean;
  id?: string;
  name?: string;
  osType?: string;
  providerImageId?: string;
  updatedAt?: string;
  visibility?: string;
}

export interface VoAdminComputeImageTeamBindingItem {
  createdAt?: string;
  id?: string;
  imageId?: string;
  teamId?: string;
  updatedAt?: string;
}

export interface VoAdminDeleteStorageRequest {
  keys?: string[];
  prefixes?: string[];
}

export interface VoAdminDigiEmployee {
  digiWorkerId?: string;
  id?: string;
  status?: string;
  teamId?: string;
  workloadCap?: number;
  workloadUsed?: number;
}

export interface VoAdminDigiEmployeeActionRequest {
  reason: string;
}

export interface VoAdminDigiEmployeeDetail {
  employee?: VoAdminDigiEmployee;
  roles?: VoAdminRole[];
  worker?: VoAdminDigiWorker;
}

export interface VoAdminDigiWorker {
  allowDeployStation?: boolean;
  autoGenerated?: boolean;
  avatar?: string;
  avatarId?: number;
  hireableCount?: number;
  hiredCount?: number;
  id?: string;
  jobTags?: VoJobTagLite[];
  marketVisible?: boolean;
  meta?: Record<string, string>;
  model?: string;
  name?: string;
  promptSpec?: ModelsPromptSpec;
  reasoningEffort?: string;
  salary?: number;
  score?: number;
  seedId?: string;
  skillsets?: VoSkillsetLite[];
  toolkitKeys?: string[];
}

export interface VoAdminDigiWorkerSeed {
  ego?: VoAdminEgoSeed;
  id?: number;
  models?: VoAdminModelCostItem[];
  skillsetIds?: string[];
  toolkits?: string[];
  weight?: number;
}

export interface VoAdminDigiWorkerSeedPreviewItem {
  explain?: string;
  llmModelId?: string;
  modelName?: string;
  monthlyPoints?: number;
  name?: string;
  salary?: number;
  score?: number;
  seedId?: number;
  skillsetIds?: string[];
  toolkits?: string[];
  workload?: number;
}

export interface VoAdminDigiWorkerSeedPreviewRequest {
  count?: number;
}

export interface VoAdminDigiWorkerSeedPreviewResponse {
  items?: VoAdminDigiWorkerSeedPreviewItem[];
}

export interface VoAdminEgoSeed {
  agreeableness?: VoAdminNumberRange;
  conscientiousness?: VoAdminNumberRange;
  extroversion?: VoAdminNumberRange;
  neuroticism?: VoAdminNumberRange;
  openness?: VoAdminNumberRange;
  workload?: VoAdminNumberRange;
}

export interface VoAdminForceReleaseRequest {
  reason: string;
}

export interface VoAdminLLMModelItem {
  cacheReadCost?: number;
  createdAt?: string;
  id?: string;
  inputCost?: number;
  model?: string;
  modelExternalName?: string;
  monthlyPoints?: number;
  name?: string;
  outputCost?: number;
  provider?: string;
  providerName?: string;
  reasoningEffort?: string;
  score?: number;
  updatedAt?: string;
}

export interface VoAdminModelCostItem {
  llmModelId?: string;
  reasoningEffort?: string;
}

export interface VoAdminMoveStorageRequest {
  destPrefix?: string;
  overwrite?: boolean;
  sources?: string[];
}

export interface VoAdminNumberRange {
  max?: number;
  min?: number;
}

export interface VoAdminOctopusClusterItem {
  fileGatewayBaseURL?: string;
  gatewayBaseURL?: string;
  isActiveForCreate?: boolean;
  key?: string;
  name?: string;
  nasRootPVCName?: string;
  podManagerBaseURL?: string;
}

export interface VoAdminPresignPrivateStorageRequest {
  key?: string;
  ttlSeconds?: number;
}

export interface VoAdminPresignPrivateStorageResponse {
  url?: string;
}

export interface VoAdminRole {
  id?: string;
  name?: string;
  promptSpec?: ModelsPromptSpec;
  requiredFeats?: string[];
  teamId?: string;
}

export interface VoAdminScanSkillsRequest {
  prefix?: string;
  teamId?: string;
  tenantId?: string;
}

export interface VoAdminScanSkillsResponse {
  deleted?: number;
  scanned?: number;
  upserted?: number;
}

export interface VoAdminSkill {
  contentSha?: string;
  description?: string;
  filePath?: string;
  id?: string;
  name?: string;
  s3Key?: string;
  skillsetId?: string;
  teamId?: string;
  tenantId?: string;
  title?: string;
  updatedAt?: string;
}

export interface VoAdminStorageEntry {
  /** For file */
  key?: string;
  name?: string;
  /** For folder */
  prefix?: string;
  size?: number;
  /** Type: "folder" | "file" */
  type?: string;
}

export interface VoAdminStorageObject {
  key?: string;
  size?: number;
}

export interface VoAdminTeamFileDeleteRequest {
  keys?: string[];
  prefixes?: string[];
  rootKind?: string;
  scope?: VoTeamRootScope;
  teamId?: string;
}

export interface VoAdminTeamFileFinalizeRequest {
  finalizeToken?: string;
  rootKind?: string;
  scope?: VoTeamRootScope;
  teamId?: string;
}

export interface VoAdminTeamFileMoveRequest {
  destPrefix?: string;
  overwrite?: boolean;
  rootKind?: string;
  scope?: VoTeamRootScope;
  sources?: string[];
  teamId?: string;
}

export interface VoAdminTeamFilePresignRequest {
  key?: string;
  rootKind?: string;
  scope?: VoTeamRootScope;
  teamId?: string;
  ttlSeconds?: number;
}

export interface VoAdminUpsertSiteConfigRequest {
  key?: string;
  scope?: string;
  tenantId?: string;
  value?: number[];
}

export interface VoArtifactDetail {
  artifactCount?: number;
  artifacts?: VoArtifactItem[];
  caseId?: string;
  completedAt?: string;
  date?: string;
  id?: string;
  jobId?: string;
  owner?: string;
  qualityScore?: number;
  status?: string;
  summary?: string;
  title?: string;
}

export interface VoArtifactDownloadURLResponse {
  downloadUrl?: string;
  expireAt?: string;
}

export interface VoArtifactItem {
  artifactId?: string;
  channel?: string;
  conversationId?: string;
  conversationKind?: string;
  createdAt?: string;
  displayPath?: string;
  externalUrl?: string;
  externalUserId?: string;
  fileName?: string;
  fileSizeBytes?: number;
  generatedByDigiEmployeeId?: string;
  id?: string;
  sourceType?: string;
  stationId?: string;
}

export interface VoArtifactListItem {
  artifactCount?: number;
  caseId?: string;
  completedAt?: string;
  date?: string;
  id?: string;
  jobId?: string;
  owner?: string;
  qualityScore?: number;
  status?: string;
  summary?: string;
  title?: string;
}

export interface VoArtifactRecentUpdate {
  artifactCount?: number;
  artifactId?: string;
  completedAt?: string;
  owner?: string;
  summary?: string;
  title?: string;
}

export interface VoArtifactSummaryResponse {
  latestCompletedAt?: string;
  recent7dArtifacts?: number;
  recentUpdates?: VoArtifactRecentUpdate[];
  totalArtifactItems?: number;
  totalArtifacts?: number;
}

export interface VoAttachConversationTeamRequest {
  teamId: string;
  title?: string;
}

export interface VoBillingCycle {
  endAt?: string;
  mode?: string;
  periodKey?: string;
  startAt?: string;
}

export interface VoBillingLedgerEntry {
  effectiveAt?: string;
  pointsDelta?: number;
  ref?: string;
  type?: string;
}

export interface VoBillingSnapshot {
  /** passthrough from host snapshot JSON */
  items?: number[];
  totalMonthlyChargePoints?: number;
}

export interface VoBillingWallet {
  balancePoints?: number;
}

export interface VoCase {
  createdAt?: string;
  description?: string;
  fileCount?: number;
  id?: string;
  ident?: string;
  name?: string;
  status?: string;
  storageUsage?: number;
  updatedAt?: string;
}

export interface VoConnectionAuthTaskAuthField {
  helpText?: string;
  key?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}

export interface VoConnectionAuthTaskCallbackRequest {
  full_url?: string;
  hash?: string;
  query?: Record<string, string>;
}

export interface VoConnectionAuthTaskConnectorRef {
  id?: string;
}

export interface VoConnectionAuthTaskCreateRequest {
  /** existing connection id for reauth */
  connection_id?: string;
  /** connector instance id */
  connector_id?: string;
  /** inherited principals */
  inherits_to?: string[];
  /** create or reauth */
  intent?: string;
  /** human-readable connection label */
  label?: string;
  /** principal pattern snapshot */
  principal_pattern?: string;
  /** optional shared-connection scope hint */
  scope?: string;
}

export interface VoConnectionAuthTaskCreateResponse {
  auth_url?: string;
  expires_at?: string;
  task_id?: string;
}

export interface VoConnectionAuthTaskDetailResponse {
  auth_type?: string;
  connection_id?: string;
  connection_label?: string;
  connector?: VoConnectionAuthTaskConnectorRef;
  error_message?: string;
  expires_at?: string;
  fields?: VoConnectionAuthTaskAuthField[];
  provider_url?: string;
  scope?: string;
  status?: string;
  task_id?: string;
}

export interface VoConnectionAuthTaskSubmitRequest {
  auth_data: Record<string, any>;
}

export interface VoContentRequest {
  content: string;
}

export interface VoContentResponse {
  content?: string;
}

export interface VoConversationAssistant {
  avatar?: string;
  digiEmployeeId?: string;
  digiWorkerId?: string;
  name?: string;
}

export interface VoConversationDesktopCurrent {
  browser?: VoConversationDesktopCurrentBrowser;
  computer?: VoConversationDesktopCurrentComputer;
  conversationId?: string;
  job?: VoConversationDesktopCurrentJob;
  revision?: number;
  todo?: VoConversationDesktopCurrentTodo;
  updatedAt?: string;
}

export interface VoConversationDesktopCurrentBrowser {
  currentUrl?: string;
  sessionId?: string;
}

export interface VoConversationDesktopCurrentComputer {
  imageId?: string;
  sessionId?: string;
  status?: string;
  transport?: string;
  viewerUrl?: string;
}

export interface VoConversationDesktopCurrentJob {
  jobId?: string;
  status?: string;
  title?: string;
}

export interface VoConversationDesktopCurrentTodo {
  explanation?: string;
  items?: VoConversationDesktopTodoItem[];
}

export interface VoConversationDesktopSnapshot {
  assetUrl?: string;
  mode?: string;
  snapshotId?: string;
  timestamp?: number;
  title?: string;
  url?: string;
}

export interface VoConversationDesktopTodoItem {
  status?: string;
  step?: string;
}

export interface VoConversationFileGrantsResponse {
  defaultCaseId?: string;
  grants?: VoFileGrant[];
}

export interface VoConversationMeta {
  assistant?: VoConversationAssistant;
  caseId?: string;
  channel?: string;
  channelUserId?: string;
  defaultCaseId?: string;
  digiEmployeeId?: string;
  externalUserId?: string;
  id?: string;
  isMultiUsers?: boolean;
  jobId?: string;
  lastMessageAt?: string;
  lastMessageText?: string;
  lastSeq?: number;
  s3Prefix?: string;
  teamId?: string;
  title?: string;
}

export interface VoConversationRuntimeItem {
  actionId?: string;
  content?: string;
  conversationId?: string;
  createdAt?: string;
  kind?: string;
  messageId?: string;
  payload?: Record<string, any>;
  receiptPolicy?: string;
  role?: string;
  seq?: number;
  turnId?: string;
  type?: string;
  uiReceipt?: Record<string, any>;
}

export interface VoConversationTempFileRef {
  contentType?: string;
  downloadUrl?: string;
  fileName?: string;
  logicalPath?: string;
  runtimePath?: string;
  sizeBytes?: number;
  uploadId?: string;
}

export interface VoConversationTempUploadAuthorizeRequest {
  contentType?: string;
  fileName?: string;
  sizeLimitBytes?: number;
}

export interface VoConversationTempUploadAuthorizeResponse {
  expireAt?: string;
  finalizeToken?: string;
  logicalPath?: string;
  method?: string;
  runtimePath?: string;
  uploadId?: string;
  uploadUrl?: string;
}

export interface VoConversationTempUploadFinalizeRequest {
  finalizeToken?: string;
  uploadId?: string;
}

export interface VoConversationTempUploadFinalizeResponse {
  contentType?: string;
  fileName?: string;
  logicalPath?: string;
  runtimePath?: string;
  sizeBytes?: number;
  uploadId?: string;
}

export interface VoConversationTurnLLMTraceCallDetail {
  apiMode?: string;
  appliedHistoryMode?: string;
  conversationId?: string;
  durationMs?: number;
  errorText?: string;
  finishedAt?: string;
  iter?: number;
  modelId?: string;
  previousResponseId?: string;
  providerId?: string;
  requestRawJson?: number[];
  responseId?: string;
  responseRawJson?: number[];
  seq?: number;
  startedAt?: string;
  status?: string;
  traceCallId?: string;
  turnId?: string;
  usage?: RuntimesnapshotHostLLMUsage;
}

export interface VoConversationTurnLLMTraceCallSummary {
  apiMode?: string;
  appliedHistoryMode?: string;
  conversationId?: string;
  durationMs?: number;
  errorText?: string;
  finishedAt?: string;
  iter?: number;
  modelId?: string;
  previousResponseId?: string;
  providerId?: string;
  responseId?: string;
  seq?: number;
  startedAt?: string;
  status?: string;
  traceCallId?: string;
  turnId?: string;
  usage?: RuntimesnapshotHostLLMUsage;
}

export interface VoCreateAdminDigiWorkerRequest {
  allowDeployStation?: boolean;
  hireableCount: number;
  id?: string;
  jobTagIds?: string[];
  marketVisible?: boolean;
  meta?: Record<string, string>;
  model?: string;
  name: string;
  promptSpec?: ModelsPromptSpec;
  reasoningEffort?: string;
  skillsets?: VoSkillsetRef[];
  toolkitKeys?: string[];
}

export interface VoCreateAdminDigiWorkerSeedRequest {
  ego?: VoAdminEgoSeed;
  models?: VoAdminModelCostItem[];
  skillsetIds?: string[];
  toolkits?: string[];
  weight?: number;
}

export interface VoCreateCaseRequest {
  description?: string;
  name: string;
}

export interface VoCreateConversationRequest {
  caseId?: string;
  defaultCaseId?: string;
  digiEmployeeId: string;
  jobId?: string;
  teamId?: string;
  title?: string;
}

export interface VoCreateCronTriggerRequest {
  actionType: string;
  cronSpec: string;
  digiEmployeeId?: string;
  enabled?: boolean;
  initialPromptTemplate?: string;
  messageTemplate?: string;
  targetConversationId?: string;
  titleTemplate?: string;
}

export interface VoCreateJobDependencyRequest {
  fromNodeKey: string;
  isHard?: boolean;
  toNodeKey: string;
}

export interface VoCreateJobNodeRequest {
  executionMode?: string;
  name: string;
  nodeKey: string;
  prompt?: string;
}

export interface VoCreateJobRequest {
  digiEmployeeId?: string;
  edges?: VoCreateJobDependencyRequest[];
  name: string;
  nodes: VoCreateJobNodeRequest[];
}

export interface VoCreateSkillsetRequest {
  description?: string;
  monthlyRentPoints?: number;
  name: string;
  teamId?: string;
  /** admin only; tenant-admin/team user ignored */
  tenantId?: string;
}

export interface VoCreateStationRequest {
  channelConfig?: Record<string, any>;
  endpointType: string;
  title?: string;
}

export interface VoCreateTeamKbDirectoryRequest {
  path: string;
}

export interface VoCreateTeamKbSyncBindingRequest {
  deviceId?: string;
  sourceKind: string;
  sourcePath: string;
  targetDirectory: string;
}

export interface VoCreateTeamMcpTunnelRequest {
  deviceId: string;
  localEndpoint: string;
  name: string;
  provider: string;
  publicEndpoint: string;
}

export interface VoCreateTeamRequest {
  bootstrapConversationId?: string;
  locale?: string;
  name?: string;
}

export interface VoCreateWecomIntegrationRequest {
  agentId?: string;
  appType?: string;
  corpid: string;
  corpsecret: string;
}

export interface VoCronTrigger {
  actionType?: string;
  createdById?: string;
  cronSpec?: string;
  digiEmployeeId?: string;
  enabled?: boolean;
  id?: string;
  initialPromptTemplate?: string;
  lastError?: string;
  lastStatus?: string;
  lastTriggeredAt?: string;
  messageTemplate?: string;
  targetConversationId?: string;
  teamId?: string;
  titleTemplate?: string;
}

export interface VoCronTriggerRun {
  actionType?: string;
  createdConversationId?: string;
  errorMessage?: string;
  finishedAt?: string;
  id?: string;
  startedAt?: string;
  status?: string;
  targetConversationId?: string;
  teamId?: string;
  triggerId?: string;
}

export interface VoDeleteExternalUserVerificationFlowResponse {
  id?: string;
}

export interface VoDigiEmployee {
  digiWorker?: VoDigiWorker;
  digiWorkerId?: string;
  hiredAt?: string;
  id?: string;
  managerDigiEmployeeId?: string;
  skillsets?: VoSkillsetLite[];
  status?: string;
  teamId?: string;
  workloadCap?: number;
  workloadUsed?: number;
}

export interface VoDigiEmployeeKBAccess {
  kbPaths?: string[];
  mode?: string;
}

export interface VoDigiEmployeeTeamSkill {
  description?: string;
  id?: string;
  name?: string;
  title?: string;
}

export interface VoDigiWorker {
  allowDeployStation?: boolean;
  avatar?: string;
  hireableCount?: number;
  hiredCount?: number;
  id?: string;
  jobTags?: VoJobTagLite[];
  marketVisible?: boolean;
  meta?: Record<string, string>;
  modelExternalName?: string;
  name?: string;
  reasoningEffort?: string;
  salary?: number;
  score?: number;
  skillsets?: VoSkillsetLite[];
  toolkitKeys?: string[];
}

export interface VoEndpointConfigField {
  hint?: string;
  key?: string;
  label?: string;
  maxLength?: number;
  pattern?: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}

export interface VoEndpointTypeConfigSchemaResponse {
  fields?: VoEndpointConfigField[];
}

export interface VoEndpointTypeItem {
  description?: string;
  id?: string;
  name?: string;
}

export interface VoExternalUserConversationItem {
  channel?: string;
  channelUserId?: string;
  digiEmployeeId?: string;
  externalUserId?: string;
  id?: string;
  isMultiUsers?: boolean;
  lastMessageAt?: string;
  lastMessageText?: string;
  teamId?: string;
  title?: string;
}

export interface VoExternalUserDetail {
  conversationCount?: number;
  externalUserId?: string;
  firstChannel?: string;
  firstChannelUserId?: string;
  identities?: VoExternalUserIdentityItem[];
  identityCount?: number;
  lastActiveAt?: string;
  mergedIntoExternalUserId?: string;
  meta?: Record<string, string>;
  status?: string;
  tags?: string[];
}

export interface VoExternalUserIdentityItem {
  channel?: string;
  channelUserId?: string;
  createdAt?: string;
}

export interface VoExternalUserListItem {
  conversationCount?: number;
  externalUserId?: string;
  firstChannel?: string;
  firstChannelUserId?: string;
  identityCount?: number;
  lastActiveAt?: string;
}

export interface VoExternalUserVerificationActionToolDefinitionItem {
  argumentKeys?: string[];
  description?: string;
  name?: string;
  toolKey?: string;
}

export interface VoExternalUserVerificationActionToolItem {
  arguments?: Record<string, any>;
  id?: string;
  sortOrder?: number;
  toolKey?: string;
}

export interface VoExternalUserVerificationFlowDetail {
  actionPrompt?: string;
  actionToolDefinitions?: VoExternalUserVerificationActionToolDefinitionItem[];
  actionTools?: VoExternalUserVerificationActionToolItem[];
  builtinKey?: string;
  createdAt?: string;
  enabled?: boolean;
  flowKind?: string;
  id?: string;
  mechanisms?: VoExternalUserVerificationMechanismItem[];
  name?: string;
  resultSchema?: Record<string, any>;
  triggerPrompt?: string;
  updatedAt?: string;
}

export interface VoExternalUserVerificationFlowListItem {
  actionToolCount?: number;
  actionToolDefinitions?: VoExternalUserVerificationActionToolDefinitionItem[];
  builtinKey?: string;
  createdAt?: string;
  enabled?: boolean;
  flowKind?: string;
  id?: string;
  mechanismCount?: number;
  name?: string;
  triggerPrompt?: string;
  updatedAt?: string;
}

export interface VoExternalUserVerificationMechanismItem {
  config?: Record<string, any>;
  id?: string;
  mechanismType?: string;
  sortOrder?: number;
}

export interface VoFileGrant {
  permission?: string;
  refId?: string;
  refType?: string;
  resourceType?: string;
}

export interface VoFileNode {
  children?: VoFileNode[];
  id?: string;
  lang?: string;
  name?: string;
  parentId?: string;
  size?: number;
  type?: string;
  updated?: string;
}

export interface VoGetDigiEmployeeTeamSkillsResponse {
  items?: VoDigiEmployeeTeamSkill[];
}

export interface VoHireDigiEmployeeRequest {
  digiWorkerId: string;
}

export interface VoHumanUser {
  email?: string;
  id?: string;
  name?: string;
}

export interface VoInboxAudit {
  action?: string;
}

export interface VoInboxItem {
  audit?: VoInboxAudit[];
  description?: string;
  id?: string;
  riskLevel?: string;
  sourceJob?: string;
  status?: string;
  timestamp?: string;
  title?: string;
  type?: string;
}

export interface VoInboxSummary {
  acceptance?: number;
  approval?: number;
  incident?: number;
  question?: number;
  review?: number;
}

export interface VoJob {
  digiEmployeeId?: string;
  edges?: VoJobDependency[];
  id?: string;
  name?: string;
  nodes?: VoJobNode[];
  state?: string;
  teamId?: string;
}

export interface VoJobDependency {
  fromNodeId?: string;
  id?: string;
  isHard?: boolean;
  jobId?: string;
  toNodeId?: string;
}

export interface VoJobNode {
  executionMode?: string;
  id?: string;
  jobId?: string;
  name?: string;
  nodeKey?: string;
  prompt?: string;
  state?: string;
}

export interface VoJobTagItem {
  code?: string;
  enabled?: boolean;
  id?: string;
  label?: string;
  portalSelectable?: boolean;
  sort?: number;
}

export interface VoJobTagLite {
  code?: string;
  id?: string;
  label?: string;
}

export interface VoLinktoolConnectionsRuntimeResponse {
  accessToken?: string;
  baseUrl?: string;
  connectionsPath?: string;
}

export interface VoLinktoolLoginCodeExchangeRequest {
  code: string;
}

export interface VoLinktoolLoginCodeExchangeResponse {
  profile?: Record<string, any>;
  summary?: VoLinktoolProfileSummary;
}

export interface VoLinktoolLoginCodeIssueResponse {
  code?: string;
  exchangeBaseUrl?: string;
  summary?: VoLinktoolProfileSummary;
}

export interface VoLinktoolLoginSessionCreateRequest {
  loginUrl: string;
}

export interface VoLinktoolLoginSessionCreateResponse {
  browserLoginUrl?: string;
  sessionId?: string;
}

export interface VoLinktoolLoginSessionDetailResponse {
  profile?: Record<string, any>;
  sessionId?: string;
  status?: string;
  summary?: VoLinktoolProfileSummary;
}

export interface VoLinktoolProfileSummary {
  displayLabel?: string;
  displayScope?: string;
  hostRoot?: string;
  loginUrl?: string;
}

export interface VoLinktoolPublishRuntimeResponse {
  accessToken?: string;
  baseUrl?: string;
  deployPath?: string;
  listPath?: string;
  publishPath?: string;
}

export interface VoLinktoolRuntimeResolveRequest {
  appId?: string;
  packageName?: string;
  profile: Record<string, any>;
}

export interface VoLinktoolTestAuthRuntimeResponse {
  callbackPath?: string;
  tunnelBaseUrl?: string;
  userHashId?: string;
  webhookPath?: string;
}

export interface VoLinktoolTunnelSessionRuntimeResponse {
  accessToken?: string;
  appId?: string;
  sessionBody?: Record<string, any>;
  tunnelPrefix?: string;
  userHashId?: string;
}

export interface VoListAdminAuditLogsResponse {
  items?: VoAdminAuditLog[];
  nextCursor?: string;
}

export interface VoListAdminComputeImageTeamBindingsResponse {
  items?: VoAdminComputeImageTeamBindingItem[];
}

export interface VoListAdminComputeImagesResponse {
  items?: VoAdminComputeImageItem[];
  nextCursor?: string;
}

export interface VoListAdminDigiEmployeesResponse {
  items?: VoAdminDigiEmployee[];
  nextCursor?: string;
}

export interface VoListAdminDigiWorkerSeedsResponse {
  items?: VoAdminDigiWorkerSeed[];
}

export interface VoListAdminDigiWorkersResponse {
  items?: VoAdminDigiWorker[];
  nextCursor?: string;
}

export interface VoListAdminLLMModelsResponse {
  items?: VoAdminLLMModelItem[];
  nextCursor?: string;
}

export interface VoListAdminOctopusClustersResponse {
  items?: VoAdminOctopusClusterItem[];
}

export interface VoListAdminPrivateStorageObjectsResponse {
  items?: VoAdminStorageObject[];
}

export interface VoListAdminSkillsResponse {
  items?: VoAdminSkill[];
  nextCursor?: string;
}

export interface VoListAdminStorageEntriesResponse {
  files?: VoAdminStorageEntry[];
  folders?: VoAdminStorageEntry[];
  hasMore?: boolean;
  nextCursor?: string;
  prefix?: string;
}

export interface VoListArtifactsResponse {
  items?: VoArtifactListItem[];
  page?: number;
  pageSize?: number;
  total?: number;
}

export interface VoListCasesResponse {
  items?: VoCase[];
}

export interface VoListConversationDesktopSnapshotsResponse {
  hasMore?: boolean;
  items?: VoConversationDesktopSnapshot[];
  nextBefore?: number;
}

export interface VoListConversationRuntimeItemsResponse {
  items?: VoConversationRuntimeItem[];
}

export interface VoListConversationTurnLLMTraceResponse {
  items?: VoConversationTurnLLMTraceCallSummary[];
}

export interface VoListCronTriggerRunsResponse {
  items?: VoCronTriggerRun[];
}

export interface VoListCronTriggersResponse {
  items?: VoCronTrigger[];
}

export interface VoListDigiEmployeesResponse {
  items?: VoDigiEmployee[];
}

export interface VoListEndpointTypesResponse {
  items?: VoEndpointTypeItem[];
}

export interface VoListExternalUserConversationsResponse {
  items?: VoExternalUserConversationItem[];
}

export interface VoListExternalUserVerificationFlowsResponse {
  items?: VoExternalUserVerificationFlowListItem[];
}

export interface VoListExternalUsersResponse {
  channels?: string[];
  items?: VoExternalUserListItem[];
}

export interface VoListIntegrationsResponse {
  items?: VoTeamIntegrationVO[];
}

export interface VoListJobsResponse {
  items?: VoJob[];
}

export interface VoListMarketDigiWorkersResponse {
  items?: VoDigiWorker[];
}

export interface VoListPinnedDigiEmployeesResponse {
  items?: string[];
}

export interface VoListRecentsResponse {
  items?: VoConversationMeta[];
}

export interface VoListReportingNeighborsResponse {
  items?: VoReportingNeighborItem[];
  self?: VoReportingNeighborSelf;
}

export interface VoListSelectableJobTagsResponse {
  items?: VoJobTagLite[];
}

export interface VoListSiteConfigResponse {
  items?: VoSiteConfigItem[];
  nextCursor?: string;
}

export interface VoListSkillsetsResponse {
  items?: VoSkillset[];
  nextCursor?: string;
}

export interface VoListStationApiKeysResponse {
  items?: VoStationApiKeyItem[];
}

export interface VoListStationsResponse {
  items?: VoStation[];
}

export interface VoListTeamComputeImagesResponse {
  items?: VoTeamComputeImageItem[];
}

export interface VoListTeamDevicesResponse {
  items?: VoTeamDevice[];
}

export interface VoListTeamExternalUserTagsResponse {
  tags?: string[];
}

export interface VoListTeamKbDirectoriesResponse {
  items?: VoTeamKbDirectory[];
}

export interface VoListTeamKbSyncBindingsResponse {
  items?: VoTeamKbSyncBinding[];
}

export interface VoListTeamKbSyncJobsResponse {
  items?: VoTeamKbSyncJob[];
}

export interface VoListTeamMcpTunnelBindingsResponse {
  items?: VoTeamMcpTunnelBinding[];
}

export interface VoListTeamMcpTunnelsResponse {
  items?: VoTeamMcpTunnel[];
}

export interface VoListTeamMembersResponse {
  items?: VoTeamMembership[];
}

export interface VoListTeamStorageEntriesResponse {
  files?: VoTeamStorageEntry[];
  folders?: VoTeamStorageEntry[];
  hasMore?: boolean;
  mount?: VoTeamStorageMount;
  nextCursor?: string;
  prefix?: string;
}

export interface VoListTeamStorageMountsResponse {
  items?: VoTeamStorageMount[];
}

export interface VoListTeamsResponse {
  items?: VoTeam[];
  nextCursor?: string;
}

export interface VoListTenantAdminDigiWorkersResponse {
  items?: VoTenantAdminDigiWorker[];
  nextCursor?: string;
}

export interface VoListTenantAdminJobTagsResponse {
  items?: VoJobTagItem[];
}

export interface VoListTenantAdminLLMModelsResponse {
  items?: VoTenantAdminLLMModelItem[];
  nextCursor?: string;
}

export interface VoListWecomContactsResponse {
  items?: VoWecomContactVO[];
  total?: number;
}

export interface VoMeResponse {
  memberships?: VoTeamMembership[];
  user?: VoHumanUser;
}

export interface VoPatchAdminComputeImageRequest {
  cpu?: number;
  description?: string;
  enabled?: boolean;
  name?: string;
  osType?: string;
  visibility?: string;
}

export interface VoPatchAdminDigiWorkerRequest {
  allowDeployStation?: boolean;
  hireableCount?: number;
  jobTagIds?: string[];
  marketVisible?: boolean;
  meta?: Record<string, string>;
  model?: string;
  name?: string;
  promptSpec?: ModelsPromptSpec;
  reasoningEffort?: string;
  skillsets?: VoSkillsetRef[];
  toolkitKeys?: string[];
}

export interface VoPatchAdminDigiWorkerSeedRequest {
  ego?: VoAdminEgoSeed;
  models?: VoAdminModelCostItem[];
  skillsetIds?: string[];
  toolkits?: string[];
  weight?: number;
}

export interface VoPatchAdminLLMModelRequest {
  cacheReadCost?: number;
  inputCost?: number;
  name?: string;
  outputCost?: number;
}

export interface VoPatchAdminOctopusClusterRequest {
  fileGatewayBaseURL?: string;
  gatewayBaseURL?: string;
  isActiveForCreate?: boolean;
  kubeconfig?: string;
  name?: string;
  nasRootPVCName?: string;
  podManagerBaseURL?: string;
}

export interface VoPatchDigiEmployeeSkillsetsRequest {
  skillsets?: VoSkillsetRef[];
}

export interface VoPatchMeRequest {
  name?: string;
}

export interface VoPatchSkillRequest {
  skillsetId?: string;
}

export interface VoPatchSkillsetRequest {
  description?: string;
  monthlyRentPoints?: number;
  name?: string;
}

export interface VoPatchTeamMcpTunnelRequest {
  localEndpoint?: string;
  name?: string;
  publicEndpoint?: string;
}

export interface VoPatchTeamMembershipProfileRequest {
  avatarSourceType?: string;
  avatarStorageKey?: string;
  avatarUrl?: string;
  displayName?: string;
}

export interface VoPortalBrand {
  browserTitle?: string;
  displayName?: string;
  logoDarkStorageKey?: string;
  logoDarkUrl?: string;
  logoStorageKey?: string;
  logoUrl?: string;
  tagline?: string;
}

export interface VoPortalBrandAssetUploadResponse {
  key?: string;
  publicUrl?: string;
}

export interface VoPortalBrandResolution {
  brand?: VoPortalBrand;
  host?: string;
  resolved?: boolean;
  tenantId?: string;
}

export interface VoPostConversationHumanTurnRequest {
  content?: string;
  tempFiles?: VoConversationTempFileRef[];
  uiReceipt?: Record<string, any>;
}

export interface VoPostConversationHumanTurnResponse {
  accepted?: boolean;
  turnId?: string;
}

export interface VoPutDigiEmployeeKBAccessRequest {
  kbPaths?: string[];
  mode: string;
}

export interface VoPutDigiEmployeeReportingLineRequest {
  managerDigiEmployeeId?: string;
}

export interface VoPutDigiEmployeeTeamSkillsRequest {
  skillIds?: string[];
}

export interface VoRegisterTeamDeviceRequest {
  clientId: string;
  clientType: string;
  deviceName: string;
  platformBaseUrl: string;
}

export interface VoRemoteTaskDeleteResponse {
  deleted?: boolean;
  id?: string;
}

export interface VoReportingNeighborItem {
  avatar?: string;
  digiEmployeeId?: string;
  name?: string;
  relationType?: string;
  title?: string;
}

export interface VoReportingNeighborSelf {
  avatar?: string;
  digiEmployeeId?: string;
  name?: string;
  title?: string;
}

export interface VoRotateStationApiKeyResponse {
  item?: VoStationApiKeyItem;
  key?: string;
  replacedKeyId?: string;
}

export interface VoSimpleOKResponse {
  ok?: boolean;
}

export interface VoSiteConfigItem {
  key?: string;
  tenantId?: string;
  value?: number[];
}

export interface VoSkillset {
  description?: string;
  id?: string;
  monthlyRentPoints?: number;
  name?: string;
  teamId?: string;
  tenantId?: string;
  updatedAt?: string;
}

export interface VoSkillsetLite {
  id?: string;
  name?: string;
}

export interface VoSkillsetRef {
  id?: string;
}

export interface VoStation {
  /** 返回时敏感字段已脱敏 */
  channelConfig?: Record<string, any>;
  createdAt?: string;
  digiEmployeeId?: string;
  endpointType?: string;
  fileAccess?: VoStationFileAccess;
  fileGrantTemplate?: VoStationFileGrantTemplate;
  id?: string;
  openaiCompat?: VoStationOpenAICompat;
  status?: string;
  teamId?: string;
  title?: string;
  updatedAt?: string;
}

export interface VoStationApiKeyItem {
  createdAt?: string;
  id?: string;
  prefix?: string;
  revokedAt?: string;
  status?: string;
}

export interface VoStationFileAccess {
  allowOtherUserDirsReadWrite?: boolean;
  allowOwnUserDirReadWrite?: boolean;
  cases?: VoStationFileAccessCase[];
}

export interface VoStationFileAccessCase {
  caseId?: string;
  permission?: string;
}

export interface VoStationFileGrantTemplate {
  grants?: VoFileGrant[];
}

export interface VoStationOpenAICompat {
  chatCompletions?: string;
  responses?: string;
}

export interface VoStationResponsesRequest {
  conversationId: string;
  input: {
    /** string | []ContentPart */
    content: any;
    role: string;
  }[];
  metadata?: Record<string, string>;
}

export interface VoStationResponsesResult {
  outputText?: string;
  responseId?: string;
  toolTrace?: VoStationToolTrace[];
}

export interface VoStationToolTrace {
  callId?: string;
  input?: Record<string, any>;
  output?: any;
  toolKey?: string;
}

export interface VoTeam {
  balancePoints?: number;
  certificationStatus?: string;
  createdAt?: string;
  digiEmployeeCount?: number;
  id?: string;
  llmTraceEnabled?: boolean;
  localeDefault?: string;
  name?: string;
  organizationProfile?: VoTeamOrganizationProfile;
  registrationName?: string;
  tags?: string[];
}

export interface VoTeamBillingSummaryResponse {
  cycle?: VoBillingCycle;
  entries?: VoBillingLedgerEntry[];
  snapshot?: VoBillingSnapshot;
  wallet?: VoBillingWallet;
}

export interface VoTeamComputeImageItem {
  cpu?: number;
  description?: string;
  id?: string;
  name?: string;
  osType?: string;
  visibility?: string;
}

export interface VoTeamDeleteRequest {
  keys?: string[];
  mountId?: string;
  prefixes?: string[];
  rootKind?: string;
  scope?: VoTeamRootScope;
}

export interface VoTeamDevice {
  boundMcpTunnelsCount?: number;
  clientId?: string;
  clientType?: string;
  deviceName?: string;
  lastSeenAt?: string;
  platformBaseUrl?: string;
  registeredAt?: string;
  status?: string;
  teamDeviceId?: string;
  teamId?: string;
}

export interface VoTeamIntegrationVO {
  agentId?: string;
  appType?: string;
  contactCount?: number;
  corpid?: string;
  /** always "***" when set */
  corpsecret?: string;
  createdAt?: string;
  id?: string;
  lastSyncAt?: string;
  provider?: string;
  status?: string;
  syncError?: string;
  syncStatus?: string;
  teamId?: string;
  updatedAt?: string;
}

export interface VoTeamKbDirectory {
  createdAt?: string;
  id?: string;
  name?: string;
  parentPath?: string;
  path?: string;
}

export interface VoTeamKbSyncBinding {
  bindingId?: string;
  createdAt?: string;
  deviceId?: string;
  sourceKind?: string;
  sourcePath?: string;
  targetDirectory?: string;
  teamId?: string;
}

export interface VoTeamKbSyncBootstrapAccessRequest {
  deviceId: string;
}

export interface VoTeamKbSyncBootstrapAccessResponse {
  accessToken?: string;
  expiresAt?: string;
  fileGatewayBaseUrl?: string;
}

export interface VoTeamKbSyncJob {
  bindingId?: string;
  createdAt?: string;
  filesChanged?: number;
  id?: string;
  status?: string;
  summary?: string;
}

export interface VoTeamMcpTunnel {
  activatedAt?: string;
  boundAgentsCount?: number;
  deactivatedAt?: string;
  deviceId?: string;
  localEndpoint?: string;
  mcpTunnelId?: string;
  name?: string;
  provider?: string;
  publicEndpoint?: string;
  status?: string;
  teamId?: string;
  updatedAt?: string;
}

export interface VoTeamMcpTunnelBinding {
  agentId?: string;
  agentName?: string;
  createdAt?: string;
  id?: string;
}

export interface VoTeamMembership {
  role?: string;
  status?: string;
  teamId?: string;
  userId?: string;
}

export interface VoTeamMembershipProfile {
  avatarSourceType?: string;
  avatarStorageKey?: string;
  avatarUrl?: string;
  createdAt?: string;
  displayName?: string;
  teamId?: string;
  updatedAt?: string;
  userId?: string;
}

export interface VoTeamMoveRequest {
  destPrefix?: string;
  mountId?: string;
  overwrite?: boolean;
  rootKind?: string;
  scope?: VoTeamRootScope;
  sources?: string[];
}

export interface VoTeamOrganizationCertificationDocument {
  documentId?: string;
  fileName?: string;
  status?: string;
}

export interface VoTeamOrganizationProfile {
  certificationDocuments?: VoTeamOrganizationCertificationDocument[];
  certificationStatus?: string;
  contactEmail?: string;
  contactName?: string;
  contactPhone?: string;
  organizationType?: string;
  registrationName?: string;
  reviewComment?: string;
  unifiedSocialCreditCode?: string;
}

export interface VoTeamPresignRequest {
  key?: string;
  mountId?: string;
  rootKind?: string;
  scope?: VoTeamRootScope;
  ttlSeconds?: number;
}

export interface VoTeamPresignResponse {
  expireAt?: string;
  finalizeToken?: string;
  method?: string;
  url?: string;
}

export interface VoTeamRootScope {
  caseIdent?: string;
  conversationId?: string;
  externalUserId?: string;
  uploadId?: string;
}

export interface VoTeamStorageEntry {
  /** file */
  key?: string;
  /** base name */
  name?: string;
  /** folder */
  prefix?: string;
  size?: number;
  /** folder|file */
  type?: string;
}

export interface VoTeamStorageMount {
  id?: string;
  mode?: string;
  name?: string;
}

export interface VoTeamUploadFinalizeRequest {
  finalizeToken?: string;
  mountId?: string;
  rootKind?: string;
  scope?: VoTeamRootScope;
}

export interface VoTeamUploadFinalizeResponse {
  contentType?: string;
  fileName?: string;
  logicalPath?: string;
  sizeBytes?: number;
}

export interface VoTenantAdminAssistantEnsureRequest {
  digiWorkerId: string;
}

export interface VoTenantAdminAssistantEnsureResponse {
  digiEmployeeId?: string;
}

export interface VoTenantAdminCreateDigiWorkerRequest {
  allowDeployStation?: boolean;
  autohire?: boolean;
  bootstrapTeamCreate?: boolean;
  hireableCount: number;
  id?: string;
  jobTagIds?: string[];
  llmModelId: string;
  marketVisible?: boolean;
  meta?: Record<string, string>;
  name: string;
  promptSpec?: ModelsPromptSpec;
  reasoningEffort?: string;
  skillsets?: VoSkillsetRef[];
  toolkitKeys?: string[];
}

export interface VoTenantAdminCreateJobTagRequest {
  code: string;
  enabled?: boolean;
  label: string;
  portalSelectable?: boolean;
  sort?: number;
}

export interface VoTenantAdminDigiEmployeeDetail {
  employee?: VoAdminDigiEmployee;
  roles?: VoAdminRole[];
  worker?: VoTenantAdminDigiWorker;
}

export interface VoTenantAdminDigiWorker {
  allowDeployStation?: boolean;
  autoGenerated?: boolean;
  autohire?: boolean;
  avatar?: string;
  avatarId?: number;
  hireableCount?: number;
  hiredCount?: number;
  id?: string;
  jobTags?: VoJobTagLite[];
  llmModelId?: string;
  marketVisible?: boolean;
  meta?: Record<string, string>;
  modelExternalName?: string;
  name?: string;
  promptSpec?: ModelsPromptSpec;
  reasoningEffort?: string;
  salary?: number;
  score?: number;
  seedId?: string;
  skillsets?: VoSkillsetLite[];
  toolkitKeys?: string[];
}

export interface VoTenantAdminDigiWorkerAutoCreateThresholdResponse {
  defaultN1?: number;
  defaultN2?: number;
  n1?: number;
  n2?: number;
  overridden?: boolean;
}

export interface VoTenantAdminDigiworkerDebugConfig {
  level?: string;
  llmTraceEnabled?: boolean;
}

export interface VoTenantAdminLLMModelItem {
  id?: string;
  monthlyPoints?: number;
  name?: string;
  reasoningEffort?: string;
}

export interface VoTenantAdminPatchDigiWorkerRequest {
  allowDeployStation?: boolean;
  autohire?: boolean;
  hireableCount?: number;
  jobTagIds?: string[];
  llmModelId?: string;
  marketVisible?: boolean;
  meta?: Record<string, string>;
  name?: string;
  promptSpec?: ModelsPromptSpec;
  reasoningEffort?: string;
  skillsets?: VoSkillsetRef[];
  toolkitKeys?: string[];
}

export interface VoTenantAdminPatchJobTagRequest {
  code?: string;
  enabled?: boolean;
  label?: string;
  portalSelectable?: boolean;
  sort?: number;
}

export interface VoTenantAdminSettlementConfig {
  profitRateBps?: number;
  teamCycle?: VoTenantAdminSettlementTeamCycleConfig;
}

export interface VoTenantAdminSettlementTeamCycleConfig {
  fixed?: VoTenantAdminSettlementTeamCycleFixed;
  mode?: string;
}

export interface VoTenantAdminSettlementTeamCycleFixed {
  day?: number;
  /** HH:MM (24h) */
  time?: string;
}

export interface VoTenantAdminUpsertDigiWorkerAutoCreateThresholdRequest {
  n1?: number;
  n2?: number;
}

export interface VoTenantAdminUpsertHireEnabledRequest {
  enabled?: boolean;
}

export interface VoUpdateCaseRequest {
  description?: string;
  name?: string;
}

export interface VoUpdateConversationFileGrantsRequest {
  defaultCaseId?: string;
  grants?: VoFileGrant[];
}

export interface VoUpdateCronTriggerRequest {
  actionType?: string;
  cronSpec?: string;
  digiEmployeeId?: string;
  initialPromptTemplate?: string;
  messageTemplate?: string;
  targetConversationId?: string;
  titleTemplate?: string;
}

export interface VoUpdateStationChannelConfigRequest {
  channelConfig: Record<string, any>;
}

export interface VoUpdateStationFileAccessRequest {
  allowOtherUserDirsReadWrite?: boolean;
  allowOwnUserDirReadWrite?: boolean;
  cases?: VoStationFileAccessCase[];
}

export interface VoUpdateStationFileGrantTemplateRequest {
  grants?: VoFileGrant[];
}

export interface VoUpdateStationRequest {
  title?: string;
}

export interface VoUpdateWecomIntegrationRequest {
  agentId?: string;
  corpid?: string;
  corpsecret?: string;
}

export interface VoUpsertAdminOctopusClusterRequest {
  fileGatewayBaseURL: string;
  gatewayBaseURL: string;
  isActiveForCreate?: boolean;
  kubeconfig: string;
  name: string;
  nasRootPVCName: string;
  podManagerBaseURL: string;
}

export interface VoUpsertExternalUserVerificationActionToolRequest {
  arguments?: Record<string, any>;
  sortOrder: number;
  toolKey: string;
}

export interface VoUpsertExternalUserVerificationFlowRequest {
  actionPrompt?: string;
  actionTools?: VoUpsertExternalUserVerificationActionToolRequest[];
  builtinKey?: string;
  enabled?: boolean;
  flowKind: string;
  mechanisms?: VoUpsertExternalUserVerificationMechanismRequest[];
  name: string;
  resultSchema?: Record<string, any>;
  triggerPrompt: string;
}

export interface VoUpsertExternalUserVerificationMechanismRequest {
  config?: Record<string, any>;
  mechanismType: string;
  sortOrder: number;
}

export interface VoUpsertFeishuIntegrationRequest {
  appId: string;
  /** 更新时留空表示保留原 Secret */
  appSecret?: string;
}

export interface VoValidateTeamKbSyncTargetRequest {
  targetDirectory: string;
}

export interface VoValidateTeamKbSyncTargetResponse {
  conflictPath?: string;
  conflictReason?: string;
  valid?: boolean;
}

export interface VoVerifyFeishuRequest {
  appId?: string;
  appSecret?: string;
}

export interface VoVerifyFeishuResponse {
  message?: string;
  valid?: boolean;
}

export interface VoVerifyWecomRequest {
  corpid?: string;
  corpsecret?: string;
}

export interface VoVerifyWecomResponse {
  corpName?: string;
  errcode?: number;
  errmsg?: string;
  valid?: boolean;
}

export interface VoWecomContactVO {
  alias?: string;
  avatarUrl?: string;
  departmentIds?: number[];
  email?: string;
  isActive?: boolean;
  mobile?: string;
  name?: string;
  position?: string;
  userid?: string;
}

export type QueryParamsType = Record<string | number, any>;
export type ResponseFormat = keyof Omit<Body, "body" | "bodyUsed">;

export interface FullRequestParams extends Omit<RequestInit, "body"> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  type?: ContentType;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseFormat;
  /** request body */
  body?: unknown;
  /** base url */
  baseUrl?: string;
  /** request cancellation token */
  cancelToken?: CancelToken;
}

export type RequestParams = Omit<FullRequestParams, "body" | "method" | "query" | "path">;

export interface ApiConfig<SecurityDataType = unknown> {
  baseUrl?: string;
  baseApiParams?: Omit<RequestParams, "baseUrl" | "cancelToken" | "signal">;
  securityWorker?: (securityData: SecurityDataType | null) => Promise<RequestParams | void> | RequestParams | void;
  customFetch?: typeof fetch;
}

export interface HttpResponse<D extends unknown, E extends unknown = unknown> extends Response {
  data: D;
  error: E;
}

type CancelToken = Symbol | string | number;

export const ContentType = {
  Json: "application/json",
  FormData: "multipart/form-data",
  UrlEncoded: "application/x-www-form-urlencoded",
  Text: "text/plain",
} as const;

export type ContentType = typeof ContentType[keyof typeof ContentType];

export class HttpClient<SecurityDataType = unknown> {
  public baseUrl: string = "/";
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>["securityWorker"];
  private abortControllers = new Map<CancelToken, AbortController>();
  private customFetch = (...fetchParams: Parameters<typeof fetch>) => fetch(...fetchParams);

  private baseApiParams: RequestParams = {
    credentials: "same-origin",
    headers: {},
    redirect: "follow",
    referrerPolicy: "no-referrer",
  };

  constructor(apiConfig: ApiConfig<SecurityDataType> = {}) {
    Object.assign(this, apiConfig);
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  protected encodeQueryParam(key: string, value: any) {
    const encodedKey = encodeURIComponent(key);
    return `${encodedKey}=${encodeURIComponent(typeof value === "number" ? value : `${value}`)}`;
  }

  protected addQueryParam(query: QueryParamsType, key: string) {
    return this.encodeQueryParam(key, query[key]);
  }

  protected addArrayQueryParam(query: QueryParamsType, key: string) {
    const value = query[key];
    return value.map((v: any) => this.encodeQueryParam(key, v)).join("&");
  }

  protected toQueryString(rawQuery?: QueryParamsType): string {
    const query = rawQuery || {};
    const keys = Object.keys(query).filter((key) => "undefined" !== typeof query[key]);
    return keys
      .map((key) => (Array.isArray(query[key]) ? this.addArrayQueryParam(query, key) : this.addQueryParam(query, key)))
      .join("&");
  }

  protected addQueryParams(rawQuery?: QueryParamsType): string {
    const queryString = this.toQueryString(rawQuery);
    return queryString ? `?${queryString}` : "";
  }

  private contentFormatters: Record<ContentType, (input: any) => any> = {
    [ContentType.Json]: (input: any) =>
      input !== null && (typeof input === "object" || typeof input === "string") ? JSON.stringify(input) : input,
    [ContentType.Text]: (input: any) => (input !== null && typeof input !== "string" ? JSON.stringify(input) : input),
    [ContentType.FormData]: (input: any) =>
      Object.keys(input || {}).reduce((formData, key) => {
        const property = input[key];
        formData.append(
          key,
          property instanceof Blob
            ? property
            : typeof property === "object" && property !== null
              ? JSON.stringify(property)
              : `${property}`,
        );
        return formData;
      }, new FormData()),
    [ContentType.UrlEncoded]: (input: any) => this.toQueryString(input),
  };

  protected mergeRequestParams(params1: RequestParams, params2?: RequestParams): RequestParams {
    return {
      ...this.baseApiParams,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...(this.baseApiParams.headers || {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  protected createAbortSignal = (cancelToken: CancelToken): AbortSignal | undefined => {
    if (this.abortControllers.has(cancelToken)) {
      const abortController = this.abortControllers.get(cancelToken);
      if (abortController) {
        return abortController.signal;
      }
      return void 0;
    }

    const abortController = new AbortController();
    this.abortControllers.set(cancelToken, abortController);
    return abortController.signal;
  };

  public abortRequest = (cancelToken: CancelToken) => {
    const abortController = this.abortControllers.get(cancelToken);

    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(cancelToken);
    }
  };

  public request = async <T = any, E = any>({
    body,
    secure,
    path,
    type,
    query,
    format,
    baseUrl,
    cancelToken,
    ...params
  }: FullRequestParams): Promise<HttpResponse<T, E>> => {
    const secureParams =
      ((typeof secure === "boolean" ? secure : this.baseApiParams.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const queryString = query && this.toQueryString(query);
    const payloadFormatter = this.contentFormatters[type || ContentType.Json];
    const responseFormat = format || requestParams.format;

    return this.customFetch(`${baseUrl || this.baseUrl || ""}${path}${queryString ? `?${queryString}` : ""}`, {
      ...requestParams,
      headers: {
        ...(requestParams.headers || {}),
        ...(type && type !== ContentType.FormData ? { "Content-Type": type } : {}),
      },
      signal: (cancelToken ? this.createAbortSignal(cancelToken) : requestParams.signal) || null,
      body: typeof body === "undefined" || body === null ? null : payloadFormatter(body),
    }).then(async (response) => {
      const r = response.clone() as HttpResponse<T, E>;
      r.data = null as unknown as T;
      r.error = null as unknown as E;

      const data = !responseFormat
        ? r
        : await response[responseFormat]()
            .then((data) => {
              if (r.ok) {
                r.data = unwrapPinResponse<T>(data);
              } else {
                r.error = data;
              }
              return r;
            })
            .catch((e) => {
              r.error = e;
              return r;
            });

      if (cancelToken) {
        this.abortControllers.delete(cancelToken);
      }

      if (!response.ok) throw data;
      return data;
    });
  };
}

/**
 * @title Host API
 * @version 1.0
 * @baseUrl /
 * @contact
 *
 * Host backend for Portal BFF
 */
export class Api<SecurityDataType extends unknown> extends HttpClient<SecurityDataType> {
  admin = {
    /**
     * No description
     *
     * @tags Admin
     * @name V1AdminAssistantEnsureCreate
     * @summary Ensure global admin assistant digiemployee (platform admin)
     * @request POST:/admin/v1/admin-assistant/ensure
     */
    v1AdminAssistantEnsureCreate: (request: VoAdminAssistantEnsureRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoAdminAssistantEnsureResponse, BasePinErr>({
        path: `/admin/v1/admin-assistant/ensure`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1AuditLogsList
     * @summary List admin audit logs (platform admin)
     * @request GET:/admin/v1/audit-logs
     */
    v1AuditLogsList: (
      query?: {
        /** Filter by resource type */
        resourceType?: string;
        /** Filter by resource id */
        resourceId?: string;
        /** Page size */
        limit?: number;
        /** Pagination cursor */
        cursor?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoListAdminAuditLogsResponse, BasePinErr>({
        path: `/admin/v1/audit-logs`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1ComputeImagesList
     * @summary List compute images (platform admin)
     * @request GET:/admin/v1/compute-images
     */
    v1ComputeImagesList: (
      query?: {
        /** Page size */
        limit?: number;
        /** Pagination cursor */
        cursor?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListAdminComputeImagesResponse, any>({
        path: `/admin/v1/compute-images`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1ComputeImagesDelete
     * @summary Delete compute image (platform admin)
     * @request DELETE:/admin/v1/compute-images/{id}
     */
    v1ComputeImagesDelete: (id: string, params: RequestParams = {}) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/admin/v1/compute-images/${id}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1ComputeImagesPartialUpdate
     * @summary Patch compute image (platform admin)
     * @request PATCH:/admin/v1/compute-images/{id}
     */
    v1ComputeImagesPartialUpdate: (id: string, request: VoPatchAdminComputeImageRequest, params: RequestParams = {}) =>
      this.request<VoAdminComputeImageItem, any>({
        path: `/admin/v1/compute-images/${id}`,
        method: "PATCH",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1ComputeImagesTeamBindingsDetail
     * @summary List compute image team bindings (platform admin)
     * @request GET:/admin/v1/compute-images/{id}/team-bindings
     */
    v1ComputeImagesTeamBindingsDetail: (id: string, params: RequestParams = {}) =>
      this.request<VoListAdminComputeImageTeamBindingsResponse, any>({
        path: `/admin/v1/compute-images/${id}/team-bindings`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1ComputeImagesTeamBindingsBatchDeleteCreate
     * @summary Batch delete compute image team bindings (platform admin)
     * @request POST:/admin/v1/compute-images/{id}/team-bindings:batch-delete
     */
    v1ComputeImagesTeamBindingsBatchDeleteCreate: (
      id: string,
      batchDelete: string,
      request: VoAdminBatchDeleteComputeImageTeamBindingsRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/admin/v1/compute-images/${id}/team-bindings${batchDelete}`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1ComputeImagesTeamBindingsBatchUpsertUpdate
     * @summary Batch upsert compute image team bindings (platform admin)
     * @request PUT:/admin/v1/compute-images/{id}/team-bindings:batch-upsert
     */
    v1ComputeImagesTeamBindingsBatchUpsertUpdate: (
      id: string,
      batchUpsert: string,
      request: VoAdminBatchUpsertComputeImageTeamBindingsRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoListAdminComputeImageTeamBindingsResponse, any>({
        path: `/admin/v1/compute-images/${id}/team-bindings${batchUpsert}`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1ComputeImagesBatchUpsertUpdate
     * @summary Batch upsert compute images (platform admin)
     * @request PUT:/admin/v1/compute-images:batch-upsert
     */
    v1ComputeImagesBatchUpsertUpdate: (
      batchUpsert: string,
      request: VoAdminBatchUpsertComputeImagesRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoAdminBatchUpsertComputeImagesResponse, any>({
        path: `/admin/v1/compute-images${batchUpsert}`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1ConnectionAuthTasksCreate
     * @summary Create connection auth task (platform scope)
     * @request POST:/admin/v1/connection-auth-tasks
     */
    v1ConnectionAuthTasksCreate: (request: VoConnectionAuthTaskCreateRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoConnectionAuthTaskCreateResponse, BasePinErr>({
        path: `/admin/v1/connection-auth-tasks`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1ConnectorsConfigConnectorsList
     * @summary List connector configs (platform scope)
     * @request GET:/admin/v1/connectors/config/connectors
     */
    v1ConnectorsConfigConnectorsList: (params: RequestParams = {}) =>
      this.request<BaseConnectorConfigListResponse, any>({
        path: `/admin/v1/connectors/config/connectors`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1ConnectorsConfigConnectorsDetail
     * @summary Get connector config detail (platform scope)
     * @request GET:/admin/v1/connectors/config/connectors/{connectorId}
     */
    v1ConnectorsConfigConnectorsDetail: (connectorId: string, params: RequestParams = {}) =>
      this.request<BaseConnectorConfigRecord, any>({
        path: `/admin/v1/connectors/config/connectors/${connectorId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1ConnectorsConfigConnectorsUpdate
     * @summary Update connector config (platform scope)
     * @request PUT:/admin/v1/connectors/config/connectors/{connectorId}
     */
    v1ConnectorsConfigConnectorsUpdate: (
      connectorId: string,
      request: BaseConnectorConfigUpdateRequest,
      params: RequestParams = {},
    ) =>
      this.request<BaseConnectorConfigRecord, any>({
        path: `/admin/v1/connectors/config/connectors/${connectorId}`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1ConnectorsPublishConnectorsList
     * @summary List connectors by platform scope
     * @request GET:/admin/v1/connectors/publish/connectors
     */
    v1ConnectorsPublishConnectorsList: (params: RequestParams = {}) =>
      this.request<ArrayBaseConnectorRegistryPackage, any>({
        path: `/admin/v1/connectors/publish/connectors`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1ConnectorsPublishDeployCreate
     * @summary Deploy connector version (platform scope)
     * @request POST:/admin/v1/connectors/publish/deploy
     */
    v1ConnectorsPublishDeployCreate: (request: BaseConnectorRegistryDeployRequest, params: RequestParams = {}) =>
      this.request<BaseConnectorRegistryDeployResponse, any>({
        path: `/admin/v1/connectors/publish/deploy`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1ConnectorsPublishPublishCreate
     * @summary Publish connector version (platform scope)
     * @request POST:/admin/v1/connectors/publish/publish
     */
    v1ConnectorsPublishPublishCreate: (request: BaseConnectorRegistryPublishRequest, params: RequestParams = {}) =>
      this.request<BaseJSONMap, any>({
        path: `/admin/v1/connectors/publish/publish`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1ConnectorsPublishUploadUrlCreate
     * @summary Create connector upload url (platform scope)
     * @request POST:/admin/v1/connectors/publish/upload-url
     */
    v1ConnectorsPublishUploadUrlCreate: (request: BaseConnectorRegistryUploadURLRequest, params: RequestParams = {}) =>
      this.request<BaseConnectorRegistryUploadURLResponse, any>({
        path: `/admin/v1/connectors/publish/upload-url`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1ConnectorsPublishVersionsList
     * @summary List connector versions by platform scope
     * @request GET:/admin/v1/connectors/publish/versions
     */
    v1ConnectorsPublishVersionsList: (
      query: {
        /** Connector ID */
        connector_id: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<ArrayBaseConnectorRegistryVersion, any>({
        path: `/admin/v1/connectors/publish/versions`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1DigiemployeesList
     * @summary List digiemployees (platform admin)
     * @request GET:/admin/v1/digiemployees
     */
    v1DigiemployeesList: (
      query?: {
        /** Team ID */
        teamId?: string;
        /** DigiWorker ID */
        digiWorkerId?: string;
        /** Status */
        status?: string;
        /** Page size */
        limit?: number;
        /** Pagination cursor */
        cursor?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoListAdminDigiEmployeesResponse, BasePinErr>({
        path: `/admin/v1/digiemployees`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1DigiemployeesDetail
     * @summary Get digiemployee detail (platform admin)
     * @request GET:/admin/v1/digiemployees/{id}
     */
    v1DigiemployeesDetail: (id: string, params: RequestParams = {}) =>
      this.request<BasePinOKVoAdminDigiEmployeeDetail, BasePinErr>({
        path: `/admin/v1/digiemployees/${id}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1DigiemployeesDisableCreate
     * @summary Disable digiemployee (platform admin)
     * @request POST:/admin/v1/digiemployees/{id}/disable
     */
    v1DigiemployeesDisableCreate: (id: string, request: VoAdminDigiEmployeeActionRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoAdminDigiEmployee, BasePinErr>({
        path: `/admin/v1/digiemployees/${id}/disable`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1DigiemployeesFireCreate
     * @summary Fire digiemployee (platform admin)
     * @request POST:/admin/v1/digiemployees/{id}/fire
     */
    v1DigiemployeesFireCreate: (id: string, request: VoAdminDigiEmployeeActionRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoAdminDigiEmployee, BasePinErr>({
        path: `/admin/v1/digiemployees/${id}/fire`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1DigiemployeesForceFireCreate
     * @summary Force fire digiemployee (platform admin)
     * @request POST:/admin/v1/digiemployees/{id}/force-fire
     */
    v1DigiemployeesForceFireCreate: (
      id: string,
      request: VoAdminDigiEmployeeActionRequest,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoAdminDigiEmployee, BasePinErr>({
        path: `/admin/v1/digiemployees/${id}/force-fire`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1DigiworkersList
     * @summary List digiworkers (platform admin)
     * @request GET:/admin/v1/digiworkers
     */
    v1DigiworkersList: (
      query?: {
        /** Only visible in market */
        onlyVisible?: boolean;
        /** Page size */
        limit?: number;
        /** Pagination cursor */
        cursor?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoListAdminDigiWorkersResponse, BasePinErr>({
        path: `/admin/v1/digiworkers`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1DigiworkersCreate
     * @summary Create digiworker (platform admin)
     * @request POST:/admin/v1/digiworkers
     */
    v1DigiworkersCreate: (request: VoCreateAdminDigiWorkerRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoAdminDigiWorker, BasePinErr>({
        path: `/admin/v1/digiworkers`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1DigiworkersPartialUpdate
     * @summary Patch digiworker (platform admin)
     * @request PATCH:/admin/v1/digiworkers/{id}
     */
    v1DigiworkersPartialUpdate: (id: string, request: VoPatchAdminDigiWorkerRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoAdminDigiWorker, BasePinErr>({
        path: `/admin/v1/digiworkers/${id}`,
        method: "PATCH",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1DigiworkersForceReleaseCreate
     * @summary Force release hiredCount (platform admin)
     * @request POST:/admin/v1/digiworkers/{id}/force-release
     */
    v1DigiworkersForceReleaseCreate: (id: string, request: VoAdminForceReleaseRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoAdminDigiWorker, BasePinErr>({
        path: `/admin/v1/digiworkers/${id}/force-release`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1DigiworkersRefreshAvatarCreate
     * @summary Refresh avatar binding by worker ID (platform admin)
     * @request POST:/admin/v1/digiworkers/{id}/refresh-avatar
     */
    v1DigiworkersRefreshAvatarCreate: (id: string, params: RequestParams = {}) =>
      this.request<BasePinOKVoAdminDigiWorker, BasePinErr>({
        path: `/admin/v1/digiworkers/${id}/refresh-avatar`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1HealthzList
     * @summary Admin health check
     * @request GET:/admin/v1/healthz
     */
    v1HealthzList: (params: RequestParams = {}) =>
      this.request<MapStringString, any>({
        path: `/admin/v1/healthz`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1LinktoolLoginCodesCreate
     * @summary Issue linktool login code for platform scope
     * @request POST:/admin/v1/linktool-login/codes
     */
    v1LinktoolLoginCodesCreate: (params: RequestParams = {}) =>
      this.request<VoLinktoolLoginCodeIssueResponse, any>({
        path: `/admin/v1/linktool-login/codes`,
        method: "POST",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1LlmModelsList
     * @summary List llm models (platform admin)
     * @request GET:/admin/v1/llm-models
     */
    v1LlmModelsList: (
      query?: {
        /** Page size */
        limit?: number;
        /** Pagination cursor */
        cursor?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListAdminLLMModelsResponse, any>({
        path: `/admin/v1/llm-models`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1LlmModelsDelete
     * @summary Delete llm model (platform admin)
     * @request DELETE:/admin/v1/llm-models/{id}
     */
    v1LlmModelsDelete: (id: string, params: RequestParams = {}) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/admin/v1/llm-models/${id}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1LlmModelsPartialUpdate
     * @summary Patch llm model (platform admin)
     * @request PATCH:/admin/v1/llm-models/{id}
     */
    v1LlmModelsPartialUpdate: (id: string, request: VoPatchAdminLLMModelRequest, params: RequestParams = {}) =>
      this.request<VoAdminLLMModelItem, any>({
        path: `/admin/v1/llm-models/${id}`,
        method: "PATCH",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1LlmModelsBatchDeleteCreate
     * @summary Batch delete llm models (platform admin)
     * @request POST:/admin/v1/llm-models:batch-delete
     */
    v1LlmModelsBatchDeleteCreate: (
      batchDelete: string,
      request: VoAdminBatchDeleteLLMModelsRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/admin/v1/llm-models${batchDelete}`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1LlmModelsBatchUpsertUpdate
     * @summary Batch upsert llm models (platform admin)
     * @request PUT:/admin/v1/llm-models:batch-upsert
     */
    v1LlmModelsBatchUpsertUpdate: (
      batchUpsert: string,
      request: VoAdminBatchUpsertLLMModelsRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoAdminBatchUpsertLLMModelsResponse, any>({
        path: `/admin/v1/llm-models${batchUpsert}`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1OctopusClustersList
     * @summary List octopus clusters (platform admin)
     * @request GET:/admin/v1/octopus-clusters
     */
    v1OctopusClustersList: (params: RequestParams = {}) =>
      this.request<VoListAdminOctopusClustersResponse, any>({
        path: `/admin/v1/octopus-clusters`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1OctopusClustersCreate
     * @summary Create octopus cluster (platform admin)
     * @request POST:/admin/v1/octopus-clusters
     */
    v1OctopusClustersCreate: (request: VoUpsertAdminOctopusClusterRequest, params: RequestParams = {}) =>
      this.request<VoAdminOctopusClusterItem, any>({
        path: `/admin/v1/octopus-clusters`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1OctopusClustersPartialUpdate
     * @summary Patch octopus cluster (platform admin)
     * @request PATCH:/admin/v1/octopus-clusters/{key}
     */
    v1OctopusClustersPartialUpdate: (
      key: string,
      request: VoPatchAdminOctopusClusterRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoAdminOctopusClusterItem, any>({
        path: `/admin/v1/octopus-clusters/${key}`,
        method: "PATCH",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1PrivateStorageDeleteCreate
     * @summary Batch delete objects/folders within private storage (platform admin)
     * @request POST:/admin/v1/private-storage/delete
     */
    v1PrivateStorageDeleteCreate: (request: VoAdminDeleteStorageRequest, params: RequestParams = {}) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/admin/v1/private-storage/delete`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1PrivateStorageEntriesList
     * @summary Browse private storage entries (platform admin)
     * @request GET:/admin/v1/private-storage/entries
     */
    v1PrivateStorageEntriesList: (
      query?: {
        /** directory prefix (empty or end with /) */
        prefix?: string;
        /** pagination cursor (startAfterKey) */
        cursor?: string;
        /** page size (<= 200) */
        limit?: number;
        /** search in current directory (direct children only) */
        q?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListAdminStorageEntriesResponse, any>({
        path: `/admin/v1/private-storage/entries`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1PrivateStorageMoveCreate
     * @summary Move objects/folders within private storage (platform admin)
     * @request POST:/admin/v1/private-storage/move
     */
    v1PrivateStorageMoveCreate: (request: VoAdminMoveStorageRequest, params: RequestParams = {}) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/admin/v1/private-storage/move`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1PrivateStorageObjectsList
     * @summary List private storage objects (platform admin)
     * @request GET:/admin/v1/private-storage/objects
     */
    v1PrivateStorageObjectsList: (
      query?: {
        /** key prefix filter */
        prefix?: string;
        /** max items (<= 5000) */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListAdminPrivateStorageObjectsResponse, any>({
        path: `/admin/v1/private-storage/objects`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1PrivateStorageObjectsDelete
     * @summary Delete private storage object (platform admin)
     * @request DELETE:/admin/v1/private-storage/objects
     */
    v1PrivateStorageObjectsDelete: (
      query: {
        /** object key */
        key: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/admin/v1/private-storage/objects`,
        method: "DELETE",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1PrivateStoragePresignGetCreate
     * @summary Presign GET for private storage object (platform admin)
     * @request POST:/admin/v1/private-storage/presign-get
     */
    v1PrivateStoragePresignGetCreate: (request: VoAdminPresignPrivateStorageRequest, params: RequestParams = {}) =>
      this.request<VoAdminPresignPrivateStorageResponse, any>({
        path: `/admin/v1/private-storage/presign-get`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1PrivateStoragePresignPutCreate
     * @summary Presign PUT for private storage object (platform admin)
     * @request POST:/admin/v1/private-storage/presign-put
     */
    v1PrivateStoragePresignPutCreate: (request: VoAdminPresignPrivateStorageRequest, params: RequestParams = {}) =>
      this.request<VoAdminPresignPrivateStorageResponse, any>({
        path: `/admin/v1/private-storage/presign-put`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1RemoteTaskInstancesList
     * @summary List remote-task connector instances (platform scope)
     * @request GET:/admin/v1/remote-task/instances
     */
    v1RemoteTaskInstancesList: (
      query?: {
        /** Instance status */
        status?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKArrayBaseRemoteTaskConnectorInstance, BasePinErr>({
        path: `/admin/v1/remote-task/instances`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1RemoteTaskInstancesCreate
     * @summary Create remote-task connector instance (platform scope)
     * @request POST:/admin/v1/remote-task/instances
     */
    v1RemoteTaskInstancesCreate: (request: BaseRemoteTaskCreateInstanceRequest, params: RequestParams = {}) =>
      this.request<BasePinOKBaseRemoteTaskConnectorInstance, BasePinErr>({
        path: `/admin/v1/remote-task/instances`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1RemoteTaskInstancesDetail
     * @summary Get remote-task connector instance detail (platform scope)
     * @request GET:/admin/v1/remote-task/instances/{instanceId}
     */
    v1RemoteTaskInstancesDetail: (instanceId: string, params: RequestParams = {}) =>
      this.request<BasePinOKBaseRemoteTaskConnectorInstance, BasePinErr>({
        path: `/admin/v1/remote-task/instances/${instanceId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1RemoteTaskInstancesUpdate
     * @summary Update remote-task connector instance (platform scope)
     * @request PUT:/admin/v1/remote-task/instances/{instanceId}
     */
    v1RemoteTaskInstancesUpdate: (
      instanceId: string,
      request: BaseRemoteTaskCreateInstanceRequest,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseRemoteTaskConnectorInstance, BasePinErr>({
        path: `/admin/v1/remote-task/instances/${instanceId}`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1RemoteTaskInstancesReviewUpdate
     * @summary Review remote-task connector instance (platform scope)
     * @request PUT:/admin/v1/remote-task/instances/{instanceId}/review
     */
    v1RemoteTaskInstancesReviewUpdate: (
      instanceId: string,
      request: BaseRemoteTaskReviewInstanceRequest,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/admin/v1/remote-task/instances/${instanceId}/review`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1RemoteTaskPackagesList
     * @summary List remote-task connector packages (platform scope)
     * @request GET:/admin/v1/remote-task/packages
     */
    v1RemoteTaskPackagesList: (
      query?: {
        /** Package status */
        status?: string;
        /** Package visibility */
        visibility?: string;
        /** Author ID */
        author_id?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseRemoteTaskConnectorPackageListResponse, BasePinErr>({
        path: `/admin/v1/remote-task/packages`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1RemoteTaskPackagesDetail
     * @summary Get remote-task connector package detail (platform scope)
     * @request GET:/admin/v1/remote-task/packages/{pkgId}
     */
    v1RemoteTaskPackagesDetail: (pkgId: string, params: RequestParams = {}) =>
      this.request<BasePinOKBaseRemoteTaskConnectorPackageDetail, BasePinErr>({
        path: `/admin/v1/remote-task/packages/${pkgId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1RemoteTaskPackagesInstancesDetail
     * @summary List remote-task connector package instances (platform scope)
     * @request GET:/admin/v1/remote-task/packages/{pkgId}/instances
     */
    v1RemoteTaskPackagesInstancesDetail: (pkgId: string, params: RequestParams = {}) =>
      this.request<BasePinOKArrayBaseRemoteTaskConnectorInstance, BasePinErr>({
        path: `/admin/v1/remote-task/packages/${pkgId}/instances`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1RemoteTaskPackagesVersionsDetail
     * @summary List remote-task connector package versions (platform scope)
     * @request GET:/admin/v1/remote-task/packages/{pkgId}/versions
     */
    v1RemoteTaskPackagesVersionsDetail: (pkgId: string, params: RequestParams = {}) =>
      this.request<BasePinOKArrayBaseRemoteTaskPackageVersion, BasePinErr>({
        path: `/admin/v1/remote-task/packages/${pkgId}/versions`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SharedConnectionsList
     * @summary List shared connections (platform scope)
     * @request GET:/admin/v1/shared-connections
     */
    v1SharedConnectionsList: (
      query?: {
        /** Principal pattern */
        principal_pattern?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/admin/v1/shared-connections`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SharedConnectionsCreate
     * @summary Create shared connection (platform scope)
     * @request POST:/admin/v1/shared-connections
     */
    v1SharedConnectionsCreate: (request: BaseJSONMap, params: RequestParams = {}) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/admin/v1/shared-connections`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SharedConnectionsFallbackExplainList
     * @summary Explain shared connection fallback (platform scope)
     * @request GET:/admin/v1/shared-connections/fallback-explain
     */
    v1SharedConnectionsFallbackExplainList: (
      query: {
        /** Connector ID */
        connector_id: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/admin/v1/shared-connections/fallback-explain`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SharedConnectionsStartAuthCreate
     * @summary Start shared connection auth (platform scope)
     * @request POST:/admin/v1/shared-connections/start-auth
     */
    v1SharedConnectionsStartAuthCreate: (request: BaseJSONMap, params: RequestParams = {}) =>
      this.request<BasePinOKBaseRemoteTaskStartAuthResponse, BasePinErr>({
        path: `/admin/v1/shared-connections/start-auth`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SharedConnectionsSubmitAuthCreate
     * @summary Submit shared connection auth (platform scope)
     * @request POST:/admin/v1/shared-connections/submit-auth
     */
    v1SharedConnectionsSubmitAuthCreate: (request: BaseJSONMap, params: RequestParams = {}) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/admin/v1/shared-connections/submit-auth`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SharedConnectionsDetail
     * @summary Get shared connection detail (platform scope)
     * @request GET:/admin/v1/shared-connections/{connectionId}
     */
    v1SharedConnectionsDetail: (connectionId: string, params: RequestParams = {}) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/admin/v1/shared-connections/${connectionId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SharedConnectionsUpdate
     * @summary Update shared connection (platform scope)
     * @request PUT:/admin/v1/shared-connections/{connectionId}
     */
    v1SharedConnectionsUpdate: (connectionId: string, request: BaseJSONMap, params: RequestParams = {}) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/admin/v1/shared-connections/${connectionId}`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SharedConnectionsDelete
     * @summary Delete shared connection (platform scope)
     * @request DELETE:/admin/v1/shared-connections/{connectionId}
     */
    v1SharedConnectionsDelete: (connectionId: string, params: RequestParams = {}) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/admin/v1/shared-connections/${connectionId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SharedConnectionsReauthCreate
     * @summary Reauth shared connection (platform scope)
     * @request POST:/admin/v1/shared-connections/{connectionId}/reauth
     */
    v1SharedConnectionsReauthCreate: (connectionId: string, request: BaseJSONMap, params: RequestParams = {}) =>
      this.request<BasePinOKBaseRemoteTaskStartAuthResponse, BasePinErr>({
        path: `/admin/v1/shared-connections/${connectionId}/reauth`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SiteConfigList
     * @summary List site config (platform admin)
     * @request GET:/admin/v1/site-config
     */
    v1SiteConfigList: (
      query: {
        /** public or internal */
        scope: string;
        /** Page size */
        limit?: number;
        /** Pagination cursor */
        cursor?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListSiteConfigResponse, any>({
        path: `/admin/v1/site-config`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SiteConfigUpdate
     * @summary Upsert site config (platform admin)
     * @request PUT:/admin/v1/site-config
     */
    v1SiteConfigUpdate: (request: VoAdminUpsertSiteConfigRequest, params: RequestParams = {}) =>
      this.request<VoSiteConfigItem, any>({
        path: `/admin/v1/site-config`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SiteConfigDelete
     * @summary Delete site config (platform admin)
     * @request DELETE:/admin/v1/site-config
     */
    v1SiteConfigDelete: (
      query: {
        /** public or internal */
        scope: string;
        /** Config key */
        key: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/admin/v1/site-config`,
        method: "DELETE",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SkillsList
     * @summary List skills (platform admin)
     * @request GET:/admin/v1/skills
     */
    v1SkillsList: (
      query?: {
        /** Search query (name/description/s3Key) */
        query?: string;
        /** Filter by tenantId */
        tenantId?: string;
        /** Filter by teamId (use 'null' for tenant-scope) */
        teamId?: string;
        /** Page size */
        limit?: number;
        /** Pagination cursor (reserved) */
        cursor?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListAdminSkillsResponse, any>({
        path: `/admin/v1/skills`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SkillsScanCreate
     * @summary Scan skills from private storage and upsert into DB (platform admin)
     * @request POST:/admin/v1/skills/scan
     */
    v1SkillsScanCreate: (request: VoAdminScanSkillsRequest, params: RequestParams = {}) =>
      this.request<VoAdminScanSkillsResponse, any>({
        path: `/admin/v1/skills/scan`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SkillsStorageDeleteCreate
     * @summary Batch delete objects/folders within skills storage (platform admin)
     * @request POST:/admin/v1/skills/storage/delete
     */
    v1SkillsStorageDeleteCreate: (request: VoAdminDeleteStorageRequest, params: RequestParams = {}) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/admin/v1/skills/storage/delete`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SkillsStorageEntriesList
     * @summary Browse skills storage entries (platform admin)
     * @request GET:/admin/v1/skills/storage/entries
     */
    v1SkillsStorageEntriesList: (
      query?: {
        /** directory prefix (empty or start with skills/ and end with /) */
        prefix?: string;
        /** pagination cursor (startAfterKey) */
        cursor?: string;
        /** page size (<= 200) */
        limit?: number;
        /** search in current directory (direct children only) */
        q?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListAdminStorageEntriesResponse, any>({
        path: `/admin/v1/skills/storage/entries`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SkillsStorageMoveCreate
     * @summary Move objects/folders within skills storage (platform admin)
     * @request POST:/admin/v1/skills/storage/move
     */
    v1SkillsStorageMoveCreate: (request: VoAdminMoveStorageRequest, params: RequestParams = {}) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/admin/v1/skills/storage/move`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SkillsStorageObjectsList
     * @summary List skills storage objects (platform admin)
     * @request GET:/admin/v1/skills/storage/objects
     */
    v1SkillsStorageObjectsList: (
      query?: {
        /** key prefix filter (must be empty or start with skills/) */
        prefix?: string;
        /** max items (<= 5000) */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListAdminPrivateStorageObjectsResponse, any>({
        path: `/admin/v1/skills/storage/objects`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SkillsStorageObjectsDelete
     * @summary Delete skills storage object (platform admin)
     * @request DELETE:/admin/v1/skills/storage/objects
     */
    v1SkillsStorageObjectsDelete: (
      query: {
        /** object key (must start with skills/) */
        key: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/admin/v1/skills/storage/objects`,
        method: "DELETE",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SkillsStoragePresignGetCreate
     * @summary Presign GET for skills storage object (platform admin)
     * @request POST:/admin/v1/skills/storage/presign-get
     */
    v1SkillsStoragePresignGetCreate: (request: VoAdminPresignPrivateStorageRequest, params: RequestParams = {}) =>
      this.request<VoAdminPresignPrivateStorageResponse, any>({
        path: `/admin/v1/skills/storage/presign-get`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SkillsStoragePresignPutCreate
     * @summary Presign PUT for skills storage object (platform admin)
     * @request POST:/admin/v1/skills/storage/presign-put
     */
    v1SkillsStoragePresignPutCreate: (request: VoAdminPresignPrivateStorageRequest, params: RequestParams = {}) =>
      this.request<VoAdminPresignPrivateStorageResponse, any>({
        path: `/admin/v1/skills/storage/presign-put`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SkillsPartialUpdate
     * @summary Patch skill (platform admin)
     * @request PATCH:/admin/v1/skills/{id}
     */
    v1SkillsPartialUpdate: (id: string, request: VoPatchSkillRequest, params: RequestParams = {}) =>
      this.request<VoAdminSkill, any>({
        path: `/admin/v1/skills/${id}`,
        method: "PATCH",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SkillsetsList
     * @summary List skillsets (platform admin)
     * @request GET:/admin/v1/skillsets
     */
    v1SkillsetsList: (
      query?: {
        /** Filter by tenantId */
        tenantId?: string;
        /** Filter by teamId (use 'null' for tenant-scope) */
        teamId?: string;
        /** Search query (name/description) */
        query?: string;
        /** Page size */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListSkillsetsResponse, any>({
        path: `/admin/v1/skillsets`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SkillsetsCreate
     * @summary Create skillset (platform admin)
     * @request POST:/admin/v1/skillsets
     */
    v1SkillsetsCreate: (request: VoCreateSkillsetRequest, params: RequestParams = {}) =>
      this.request<VoSkillset, any>({
        path: `/admin/v1/skillsets`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SkillsetsDelete
     * @summary Delete skillset (platform admin)
     * @request DELETE:/admin/v1/skillsets/{id}
     */
    v1SkillsetsDelete: (id: string, params: RequestParams = {}) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/admin/v1/skillsets/${id}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1SkillsetsPartialUpdate
     * @summary Patch skillset (platform admin)
     * @request PATCH:/admin/v1/skillsets/{id}
     */
    v1SkillsetsPartialUpdate: (id: string, request: VoPatchSkillsetRequest, params: RequestParams = {}) =>
      this.request<VoSkillset, any>({
        path: `/admin/v1/skillsets/${id}`,
        method: "PATCH",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1TeamFilesDeleteCreate
     * @summary Delete team root files (platform admin)
     * @request POST:/admin/v1/team-files/delete
     */
    v1TeamFilesDeleteCreate: (request: VoAdminTeamFileDeleteRequest, params: RequestParams = {}) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/admin/v1/team-files/delete`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1TeamFilesEntriesList
     * @summary Browse team root file entries (platform admin)
     * @request GET:/admin/v1/team-files/entries
     */
    v1TeamFilesEntriesList: (
      query: {
        /** team id */
        teamId: string;
        /** root kind */
        rootKind: string;
        /** case ident */
        caseIdent?: string;
        /** external user id */
        externalUserId?: string;
        /** conversation id */
        conversationId?: string;
        /** upload id */
        uploadId?: string;
        /** directory prefix */
        prefix?: string;
        /** pagination cursor */
        cursor?: string;
        /** page size (<=200) */
        limit?: number;
        /** search direct children by name */
        q?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListTeamStorageEntriesResponse, any>({
        path: `/admin/v1/team-files/entries`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1TeamFilesMoveCreate
     * @summary Move team root files (platform admin)
     * @request POST:/admin/v1/team-files/move
     */
    v1TeamFilesMoveCreate: (request: VoAdminTeamFileMoveRequest, params: RequestParams = {}) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/admin/v1/team-files/move`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1TeamFilesPresignGetCreate
     * @summary Presign GET for team root file (platform admin)
     * @request POST:/admin/v1/team-files/presign-get
     */
    v1TeamFilesPresignGetCreate: (request: VoAdminTeamFilePresignRequest, params: RequestParams = {}) =>
      this.request<VoTeamPresignResponse, any>({
        path: `/admin/v1/team-files/presign-get`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1TeamFilesPresignPutCreate
     * @summary Presign PUT for team root file (platform admin)
     * @request POST:/admin/v1/team-files/presign-put
     */
    v1TeamFilesPresignPutCreate: (request: VoAdminTeamFilePresignRequest, params: RequestParams = {}) =>
      this.request<VoTeamPresignResponse, any>({
        path: `/admin/v1/team-files/presign-put`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1TeamFilesUploadFinalizeCreate
     * @summary Finalize uploaded team root file (platform admin)
     * @request POST:/admin/v1/team-files/upload-finalize
     */
    v1TeamFilesUploadFinalizeCreate: (request: VoAdminTeamFileFinalizeRequest, params: RequestParams = {}) =>
      this.request<VoTeamUploadFinalizeResponse, any>({
        path: `/admin/v1/team-files/upload-finalize`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1TeamsList
     * @summary List all teams (platform admin)
     * @request GET:/admin/v1/teams
     */
    v1TeamsList: (
      query?: {
        /** Page size */
        limit?: number;
        /** Pagination cursor */
        cursor?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListTeamsResponse, any>({
        path: `/admin/v1/teams`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1TenantsPortalBrandDetail
     * @summary Get tenant portal brand (platform admin)
     * @request GET:/admin/v1/tenants/{tenantId}/portal-brand
     */
    v1TenantsPortalBrandDetail: (tenantId: string, params: RequestParams = {}) =>
      this.request<BasePinOKVoPortalBrand, BasePinErr>({
        path: `/admin/v1/tenants/${tenantId}/portal-brand`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1TenantsPortalBrandUpdate
     * @summary Upsert tenant portal brand (platform admin)
     * @request PUT:/admin/v1/tenants/{tenantId}/portal-brand
     */
    v1TenantsPortalBrandUpdate: (tenantId: string, request: VoPortalBrand, params: RequestParams = {}) =>
      this.request<BasePinOKVoSimpleOKResponse, BasePinErr>({
        path: `/admin/v1/tenants/${tenantId}/portal-brand`,
        method: "PUT",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Admin
     * @name V1TenantsPortalBrandAssetsCreate
     * @summary Upload tenant portal brand asset (platform admin)
     * @request POST:/admin/v1/tenants/{tenantId}/portal-brand-assets
     */
    v1TenantsPortalBrandAssetsCreate: (
      tenantId: string,
      data: {
        /** asset kind */
        kind: string;
        /** portal brand asset file */
        file: File;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoPortalBrandAssetUploadResponse, BasePinErr>({
        path: `/admin/v1/tenants/${tenantId}/portal-brand-assets`,
        method: "POST",
        body: data,
        type: ContentType.FormData,
        format: "json",
        ...params,
      }),
  };
  api = {
    /**
     * No description
     *
     * @tags StationAPI
     * @name StationV1ResponsesCreate
     * @summary OpenAI-compatible station responses (internal)
     * @request POST:/api/station/{stationId}/v1/responses
     */
    stationV1ResponsesCreate: (stationId: string, request: VoStationResponsesRequest, params: RequestParams = {}) =>
      this.request<VoStationResponsesResult, any>({
        path: `/api/station/${stationId}/v1/responses`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Bootstrap
     * @name V1BootstrapTeamCreateAssistantList
     * @summary Get team-create bootstrap assistant (for header display before first message)
     * @request GET:/api/v1/bootstrap/team-create/assistant
     */
    v1BootstrapTeamCreateAssistantList: (params: RequestParams = {}) =>
      this.request<BasePinOKVoConversationAssistant, BasePinErr>({
        path: `/api/v1/bootstrap/team-create/assistant`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1ConnectionAuthTasksDetail
     * @summary Get connection auth task
     * @request GET:/api/v1/connection-auth-tasks/{taskId}
     */
    v1ConnectionAuthTasksDetail: (taskId: string, params: RequestParams = {}) =>
      this.request<BasePinOKVoConnectionAuthTaskDetailResponse, BasePinErr>({
        path: `/api/v1/connection-auth-tasks/${taskId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1ConnectionAuthTasksCallbackCreate
     * @summary Complete connection auth task callback
     * @request POST:/api/v1/connection-auth-tasks/{taskId}/callback
     */
    v1ConnectionAuthTasksCallbackCreate: (
      taskId: string,
      request: VoConnectionAuthTaskCallbackRequest,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoConnectionAuthTaskDetailResponse, BasePinErr>({
        path: `/api/v1/connection-auth-tasks/${taskId}/callback`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1ConnectionAuthTasksSubmitCreate
     * @summary Submit connection auth task
     * @request POST:/api/v1/connection-auth-tasks/{taskId}/submit
     */
    v1ConnectionAuthTasksSubmitCreate: (
      taskId: string,
      request: VoConnectionAuthTaskSubmitRequest,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoConnectionAuthTaskDetailResponse, BasePinErr>({
        path: `/api/v1/connection-auth-tasks/${taskId}/submit`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Conversations
     * @name V1ConversationsCreate
     * @summary Create conversation
     * @request POST:/api/v1/conversations
     */
    v1ConversationsCreate: (request: VoCreateConversationRequest, params: RequestParams = {}) =>
      this.request<VoConversationMeta, any>({
        path: `/api/v1/conversations`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Conversations
     * @name V1ConversationsRecentsList
     * @summary List recent conversations for current user
     * @request GET:/api/v1/conversations/recents
     */
    v1ConversationsRecentsList: (
      query?: {
        /** Max items to return */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListRecentsResponse, any>({
        path: `/api/v1/conversations/recents`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Conversations
     * @name V1ConversationsAttachTeamCreate
     * @summary Attach conversation to team
     * @request POST:/api/v1/conversations/{id}/attach-team
     */
    v1ConversationsAttachTeamCreate: (
      id: string,
      request: VoAttachConversationTeamRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoConversationMeta, any>({
        path: `/api/v1/conversations/${id}/attach-team`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Conversations
     * @name V1ConversationsDesktopCurrentDetail
     * @summary Get conversation desktop current state
     * @request GET:/api/v1/conversations/{id}/desktop/current
     */
    v1ConversationsDesktopCurrentDetail: (id: string, params: RequestParams = {}) =>
      this.request<VoConversationDesktopCurrent, any>({
        path: `/api/v1/conversations/${id}/desktop/current`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Conversations
     * @name V1ConversationsDesktopSnapshotsDetail
     * @summary List conversation desktop snapshots
     * @request GET:/api/v1/conversations/{id}/desktop/snapshots
     */
    v1ConversationsDesktopSnapshotsDetail: (
      id: string,
      query?: {
        /** Max items to return */
        limit?: number;
        /** List snapshots before timestamp */
        before?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListConversationDesktopSnapshotsResponse, any>({
        path: `/api/v1/conversations/${id}/desktop/snapshots`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Conversations
     * @name V1ConversationsDesktopSnapshotsAssetDetail
     * @summary Proxy conversation desktop snapshot asset
     * @request GET:/api/v1/conversations/{id}/desktop/snapshots/{snapshotId}/asset
     */
    v1ConversationsDesktopSnapshotsAssetDetail: (id: string, snapshotId: string, params: RequestParams = {}) =>
      this.request<File, any>({
        path: `/api/v1/conversations/${id}/desktop/snapshots/${snapshotId}/asset`,
        method: "GET",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Conversations
     * @name V1ConversationsFileGrantsDetail
     * @summary Get conversation file grants
     * @request GET:/api/v1/conversations/{id}/file-grants
     */
    v1ConversationsFileGrantsDetail: (id: string, params: RequestParams = {}) =>
      this.request<VoConversationFileGrantsResponse, any>({
        path: `/api/v1/conversations/${id}/file-grants`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Conversations
     * @name V1ConversationsFileGrantsUpdate
     * @summary Update conversation file grants
     * @request PUT:/api/v1/conversations/{id}/file-grants
     */
    v1ConversationsFileGrantsUpdate: (
      id: string,
      request: VoUpdateConversationFileGrantsRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoConversationFileGrantsResponse, any>({
        path: `/api/v1/conversations/${id}/file-grants`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Conversations
     * @name V1ConversationsMessagesDetail
     * @summary List conversation runtime messages
     * @request GET:/api/v1/conversations/{id}/messages
     */
    v1ConversationsMessagesDetail: (
      id: string,
      query?: {
        /** Max items to return */
        limit?: number;
        /** Only return items after seq */
        seq?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListConversationRuntimeItemsResponse, any>({
        path: `/api/v1/conversations/${id}/messages`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Conversations
     * @name V1ConversationsStreamDetail
     * @summary Stream conversation runtime events
     * @request GET:/api/v1/conversations/{id}/stream
     */
    v1ConversationsStreamDetail: (
      id: string,
      query?: {
        /** Only stream events after seq */
        afterSeq?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<string, any>({
        path: `/api/v1/conversations/${id}/stream`,
        method: "GET",
        query: query,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Conversations
     * @name V1ConversationsTempFilesUploadAuthorizeCreate
     * @summary Authorize direct upload for a conversation temp file
     * @request POST:/api/v1/conversations/{id}/temp-files/upload-authorize
     */
    v1ConversationsTempFilesUploadAuthorizeCreate: (
      id: string,
      request: VoConversationTempUploadAuthorizeRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoConversationTempUploadAuthorizeResponse, any>({
        path: `/api/v1/conversations/${id}/temp-files/upload-authorize`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Conversations
     * @name V1ConversationsTempFilesUploadFinalizeCreate
     * @summary Finalize direct upload for a conversation temp file
     * @request POST:/api/v1/conversations/{id}/temp-files/upload-finalize
     */
    v1ConversationsTempFilesUploadFinalizeCreate: (
      id: string,
      request: VoConversationTempUploadFinalizeRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoConversationTempUploadFinalizeResponse, any>({
        path: `/api/v1/conversations/${id}/temp-files/upload-finalize`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Conversations
     * @name V1ConversationsTurnsHumanCreate
     * @summary Post conversation human turn
     * @request POST:/api/v1/conversations/{id}/turns/human
     */
    v1ConversationsTurnsHumanCreate: (
      id: string,
      request: VoPostConversationHumanTurnRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoPostConversationHumanTurnResponse, any>({
        path: `/api/v1/conversations/${id}/turns/human`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Conversations
     * @name V1ConversationsTurnsLlmTraceDetail
     * @summary List conversation turn LLM trace calls
     * @request GET:/api/v1/conversations/{id}/turns/{turnId}/llm-trace
     */
    v1ConversationsTurnsLlmTraceDetail: (id: string, turnId: string, params: RequestParams = {}) =>
      this.request<VoListConversationTurnLLMTraceResponse, any>({
        path: `/api/v1/conversations/${id}/turns/${turnId}/llm-trace`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Conversations
     * @name V1ConversationsTurnsLlmTraceDetail2
     * @summary Get conversation turn LLM trace call detail
     * @request GET:/api/v1/conversations/{id}/turns/{turnId}/llm-trace/{traceCallId}
     * @originalName v1ConversationsTurnsLlmTraceDetail
     * @duplicate
     */
    v1ConversationsTurnsLlmTraceDetail2: (
      id: string,
      turnId: string,
      traceCallId: string,
      params: RequestParams = {},
    ) =>
      this.request<VoConversationTurnLLMTraceCallDetail, any>({
        path: `/api/v1/conversations/${id}/turns/${turnId}/llm-trace/${traceCallId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags EndpointTypes
     * @name V1EndpointTypesList
     * @summary List supported endpoint types (for Deploy)
     * @request GET:/api/v1/endpoint-types
     */
    v1EndpointTypesList: (params: RequestParams = {}) =>
      this.request<VoListEndpointTypesResponse, any>({
        path: `/api/v1/endpoint-types`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags EndpointTypes
     * @name V1EndpointTypesConfigSchemaDetail
     * @summary Get config schema for an endpoint type
     * @request GET:/api/v1/endpoint-types/{endpointType}/config-schema
     */
    v1EndpointTypesConfigSchemaDetail: (endpointType: string, params: RequestParams = {}) =>
      this.request<VoEndpointTypeConfigSchemaResponse, any>({
        path: `/api/v1/endpoint-types/${endpointType}/config-schema`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Liveness probe
     *
     * @tags Health
     * @name V1HealthzList
     * @summary Health check
     * @request GET:/api/v1/healthz
     */
    v1HealthzList: (params: RequestParams = {}) =>
      this.request<MapStringString, any>({
        path: `/api/v1/healthz`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1LinktoolLoginExchangeCreate
     * @summary Exchange linktool login code for full profile
     * @request POST:/api/v1/linktool-login/exchange
     */
    v1LinktoolLoginExchangeCreate: (request: VoLinktoolLoginCodeExchangeRequest, params: RequestParams = {}) =>
      this.request<VoLinktoolLoginCodeExchangeResponse, any>({
        path: `/api/v1/linktool-login/exchange`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1LinktoolLoginSessionsCreate
     * @summary Create linktool login session
     * @request POST:/api/v1/linktool-login/sessions
     */
    v1LinktoolLoginSessionsCreate: (request: VoLinktoolLoginSessionCreateRequest, params: RequestParams = {}) =>
      this.request<VoLinktoolLoginSessionCreateResponse, any>({
        path: `/api/v1/linktool-login/sessions`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1LinktoolLoginSessionsDetail
     * @summary Get linktool login session detail
     * @request GET:/api/v1/linktool-login/sessions/{sessionId}
     */
    v1LinktoolLoginSessionsDetail: (sessionId: string, params: RequestParams = {}) =>
      this.request<VoLinktoolLoginSessionDetailResponse, any>({
        path: `/api/v1/linktool-login/sessions/${sessionId}`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1LinktoolLoginSessionsCompleteCreate
     * @summary Complete linktool login session through unified auth route
     * @request POST:/api/v1/linktool-login/sessions/{sessionId}/complete
     */
    v1LinktoolLoginSessionsCompleteCreate: (
      sessionId: string,
      body: LinktoolLoginAuthCompleteSessionRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoLinktoolLoginSessionDetailResponse, any>({
        path: `/api/v1/linktool-login/sessions/${sessionId}/complete`,
        method: "POST",
        body: body,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1LinktoolRuntimeConnectionsCreate
     * @summary Resolve syntool connections runtime from opaque profile
     * @request POST:/api/v1/linktool-runtime/connections
     */
    v1LinktoolRuntimeConnectionsCreate: (request: VoLinktoolRuntimeResolveRequest, params: RequestParams = {}) =>
      this.request<VoLinktoolConnectionsRuntimeResponse, any>({
        path: `/api/v1/linktool-runtime/connections`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1LinktoolRuntimePublishCreate
     * @summary Resolve syntool publish runtime from opaque profile
     * @request POST:/api/v1/linktool-runtime/publish
     */
    v1LinktoolRuntimePublishCreate: (request: VoLinktoolRuntimeResolveRequest, params: RequestParams = {}) =>
      this.request<VoLinktoolPublishRuntimeResponse, any>({
        path: `/api/v1/linktool-runtime/publish`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1LinktoolRuntimeTestAuthCreate
     * @summary Resolve syntool test-auth runtime from opaque profile
     * @request POST:/api/v1/linktool-runtime/test-auth
     */
    v1LinktoolRuntimeTestAuthCreate: (request: VoLinktoolRuntimeResolveRequest, params: RequestParams = {}) =>
      this.request<VoLinktoolTestAuthRuntimeResponse, any>({
        path: `/api/v1/linktool-runtime/test-auth`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1LinktoolRuntimeTunnelSessionCreate
     * @summary Resolve syntool tunnel-session runtime from opaque profile
     * @request POST:/api/v1/linktool-runtime/tunnel-session
     */
    v1LinktoolRuntimeTunnelSessionCreate: (request: VoLinktoolRuntimeResolveRequest, params: RequestParams = {}) =>
      this.request<VoLinktoolTunnelSessionRuntimeResponse, any>({
        path: `/api/v1/linktool-runtime/tunnel-session`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Market
     * @name V1MarketDigiworkersList
     * @summary List market digiwokers (tenant-scoped; uses JWT instance_id)
     * @request GET:/api/v1/market/digiworkers
     */
    v1MarketDigiworkersList: (
      query?: {
        /** Search query (worker name / job tag / toolkit key) */
        query?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListMarketDigiWorkersResponse, any>({
        path: `/api/v1/market/digiworkers`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Session
     * @name V1MeList
     * @summary Get current user
     * @request GET:/api/v1/me
     */
    v1MeList: (params: RequestParams = {}) =>
      this.request<VoMeResponse, any>({
        path: `/api/v1/me`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Session
     * @name V1MePartialUpdate
     * @summary Update current user
     * @request PATCH:/api/v1/me
     */
    v1MePartialUpdate: (request: VoPatchMeRequest, params: RequestParams = {}) =>
      this.request<VoMeResponse, any>({
        path: `/api/v1/me`,
        method: "PATCH",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Resolve tenant portal brand from current request host. `host` query is allowed only for local development/testing override.
     *
     * @tags PortalBrand
     * @name V1PortalBrandResolveList
     * @summary Resolve portal brand by host
     * @request GET:/api/v1/portal-brand/resolve
     */
    v1PortalBrandResolveList: (
      query?: {
        /** Optional host override for local development/testing */
        host?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoPortalBrandResolution, BasePinErr>({
        path: `/api/v1/portal-brand/resolve`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description tenantId 从 JWT claim `instance_id` 推导，前端无需传 tenantId（如仍传则必须与 token 一致）
     *
     * @tags SiteConfig
     * @name V1SiteConfigPublicList
     * @summary Get public site config
     * @request GET:/api/v1/site-config/public
     */
    v1SiteConfigPublicList: (
      query?: {
        /** Config key */
        key?: string;
        /** Comma-separated config keys (batch mode) */
        keys?: string;
        /** Page size */
        limit?: number;
        /** Pagination cursor */
        cursor?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListSiteConfigResponse, any>({
        path: `/api/v1/site-config/public`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsList
     * @summary List teams
     * @request GET:/api/v1/teams
     */
    v1TeamsList: (params: RequestParams = {}) =>
      this.request<VoListTeamsResponse, any>({
        path: `/api/v1/teams`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsCreate
     * @summary Create team
     * @request POST:/api/v1/teams
     */
    v1TeamsCreate: (request: VoCreateTeamRequest, params: RequestParams = {}) =>
      this.request<VoTeam, any>({
        path: `/api/v1/teams`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsDetail
     * @summary Get team by id
     * @request GET:/api/v1/teams/{teamId}
     */
    v1TeamsDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<VoTeam, any>({
        path: `/api/v1/teams/${teamId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Artifacts
     * @name V1TeamsArtifactsDetail
     * @summary List artifacts
     * @request GET:/api/v1/teams/{teamId}/artifacts
     */
    v1TeamsArtifactsDetail: (
      teamId: string,
      query?: {
        /** Search artifact title */
        q?: string;
        /** Sort field, only completed_at is supported */
        sort?: string;
        /** Sort order, asc or desc */
        order?: string;
        /** Filter by generated digiEmployeeId */
        employeeId?: string;
        /** Page number, starting from 1 */
        page?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListArtifactsResponse, any>({
        path: `/api/v1/teams/${teamId}/artifacts`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Artifacts
     * @name V1TeamsArtifactsSummaryDetail
     * @summary Get artifact summary
     * @request GET:/api/v1/teams/{teamId}/artifacts/summary
     */
    v1TeamsArtifactsSummaryDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<VoArtifactSummaryResponse, any>({
        path: `/api/v1/teams/${teamId}/artifacts/summary`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Artifacts
     * @name V1TeamsArtifactsDetail2
     * @summary Get artifact
     * @request GET:/api/v1/teams/{teamId}/artifacts/{artifactId}
     * @originalName v1TeamsArtifactsDetail
     * @duplicate
     */
    v1TeamsArtifactsDetail2: (teamId: string, artifactId: string, params: RequestParams = {}) =>
      this.request<VoArtifactDetail, any>({
        path: `/api/v1/teams/${teamId}/artifacts/${artifactId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Artifacts
     * @name V1TeamsArtifactsItemsDownloadUrlCreate
     * @summary Get artifact item download URL
     * @request POST:/api/v1/teams/{teamId}/artifacts/{artifactId}/items/{itemId}/download-url
     */
    v1TeamsArtifactsItemsDownloadUrlCreate: (
      teamId: string,
      artifactId: string,
      itemId: string,
      params: RequestParams = {},
    ) =>
      this.request<VoArtifactDownloadURLResponse, any>({
        path: `/api/v1/teams/${teamId}/artifacts/${artifactId}/items/${itemId}/download-url`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Billing
     * @name V1TeamsBillingSummaryDetail
     * @summary Get team billing summary
     * @request GET:/api/v1/teams/{teamId}/billing/summary
     */
    v1TeamsBillingSummaryDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<BasePinOKVoTeamBillingSummaryResponse, BasePinErr>({
        path: `/api/v1/teams/${teamId}/billing/summary`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Cases
     * @name V1TeamsCasesDetail
     * @summary List cases
     * @request GET:/api/v1/teams/{teamId}/cases
     */
    v1TeamsCasesDetail: (
      teamId: string,
      query?: {
        /** Case status */
        status?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListCasesResponse, any>({
        path: `/api/v1/teams/${teamId}/cases`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Cases
     * @name V1TeamsCasesCreate
     * @summary Create case
     * @request POST:/api/v1/teams/{teamId}/cases
     */
    v1TeamsCasesCreate: (teamId: string, request: VoCreateCaseRequest, params: RequestParams = {}) =>
      this.request<VoCase, any>({
        path: `/api/v1/teams/${teamId}/cases`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Cases
     * @name V1TeamsCasesDetail2
     * @summary Get case
     * @request GET:/api/v1/teams/{teamId}/cases/{caseId}
     * @originalName v1TeamsCasesDetail
     * @duplicate
     */
    v1TeamsCasesDetail2: (teamId: string, caseId: string, params: RequestParams = {}) =>
      this.request<VoCase, any>({
        path: `/api/v1/teams/${teamId}/cases/${caseId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Cases
     * @name V1TeamsCasesPartialUpdate
     * @summary Update case
     * @request PATCH:/api/v1/teams/{teamId}/cases/{caseId}
     */
    v1TeamsCasesPartialUpdate: (
      teamId: string,
      caseId: string,
      request: VoUpdateCaseRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoCase, any>({
        path: `/api/v1/teams/${teamId}/cases/${caseId}`,
        method: "PATCH",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Cases
     * @name V1TeamsCasesArchiveCreate
     * @summary Archive case
     * @request POST:/api/v1/teams/{teamId}/cases/{caseId}/archive
     */
    v1TeamsCasesArchiveCreate: (teamId: string, caseId: string, params: RequestParams = {}) =>
      this.request<VoCase, any>({
        path: `/api/v1/teams/${teamId}/cases/${caseId}/archive`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Cases
     * @name V1TeamsCasesDeleteCreate
     * @summary Delete case
     * @request POST:/api/v1/teams/{teamId}/cases/{caseId}/delete
     */
    v1TeamsCasesDeleteCreate: (teamId: string, caseId: string, params: RequestParams = {}) =>
      this.request<VoCase, any>({
        path: `/api/v1/teams/${teamId}/cases/${caseId}/delete`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Cases
     * @name V1TeamsCasesRestoreCreate
     * @summary Restore case
     * @request POST:/api/v1/teams/{teamId}/cases/{caseId}/restore
     */
    v1TeamsCasesRestoreCreate: (teamId: string, caseId: string, params: RequestParams = {}) =>
      this.request<VoCase, any>({
        path: `/api/v1/teams/${teamId}/cases/${caseId}/restore`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsComputeImagesDetail
     * @summary List visible compute images for team
     * @request GET:/api/v1/teams/{teamId}/compute-images
     */
    v1TeamsComputeImagesDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<VoListTeamComputeImagesResponse, any>({
        path: `/api/v1/teams/${teamId}/compute-images`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsConnectionAuthTasksCreate
     * @summary Create connection auth task (team scope)
     * @request POST:/api/v1/teams/{teamId}/connection-auth-tasks
     */
    v1TeamsConnectionAuthTasksCreate: (
      teamId: string,
      request: VoConnectionAuthTaskCreateRequest,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoConnectionAuthTaskCreateResponse, BasePinErr>({
        path: `/api/v1/teams/${teamId}/connection-auth-tasks`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsConnectorsConfigConnectorsDetail
     * @summary List connector configs (team scope)
     * @request GET:/api/v1/teams/{teamId}/connectors/config/connectors
     */
    v1TeamsConnectorsConfigConnectorsDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<BaseConnectorConfigListResponse, any>({
        path: `/api/v1/teams/${teamId}/connectors/config/connectors`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsConnectorsConfigConnectorsDetail2
     * @summary Get connector config detail (team scope)
     * @request GET:/api/v1/teams/{teamId}/connectors/config/connectors/{connectorId}
     * @originalName v1TeamsConnectorsConfigConnectorsDetail
     * @duplicate
     */
    v1TeamsConnectorsConfigConnectorsDetail2: (teamId: string, connectorId: string, params: RequestParams = {}) =>
      this.request<BaseConnectorConfigRecord, any>({
        path: `/api/v1/teams/${teamId}/connectors/config/connectors/${connectorId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsConnectorsConfigConnectorsUpdate
     * @summary Update connector config (team scope)
     * @request PUT:/api/v1/teams/{teamId}/connectors/config/connectors/{connectorId}
     */
    v1TeamsConnectorsConfigConnectorsUpdate: (
      teamId: string,
      connectorId: string,
      request: BaseConnectorConfigUpdateRequest,
      params: RequestParams = {},
    ) =>
      this.request<BaseConnectorConfigRecord, any>({
        path: `/api/v1/teams/${teamId}/connectors/config/connectors/${connectorId}`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsConnectorsPublishConnectorsDetail
     * @summary List connectors by team scope
     * @request GET:/api/v1/teams/{teamId}/connectors/publish/connectors
     */
    v1TeamsConnectorsPublishConnectorsDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<ArrayBaseConnectorRegistryPackage, any>({
        path: `/api/v1/teams/${teamId}/connectors/publish/connectors`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsConnectorsPublishDeployCreate
     * @summary Deploy connector version (team scope)
     * @request POST:/api/v1/teams/{teamId}/connectors/publish/deploy
     */
    v1TeamsConnectorsPublishDeployCreate: (
      teamId: string,
      request: BaseConnectorRegistryDeployRequest,
      params: RequestParams = {},
    ) =>
      this.request<BaseConnectorRegistryDeployResponse, any>({
        path: `/api/v1/teams/${teamId}/connectors/publish/deploy`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsConnectorsPublishPublishCreate
     * @summary Publish connector version (team scope)
     * @request POST:/api/v1/teams/{teamId}/connectors/publish/publish
     */
    v1TeamsConnectorsPublishPublishCreate: (
      teamId: string,
      request: BaseConnectorRegistryPublishRequest,
      params: RequestParams = {},
    ) =>
      this.request<BaseJSONMap, any>({
        path: `/api/v1/teams/${teamId}/connectors/publish/publish`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsConnectorsPublishUploadUrlCreate
     * @summary Create connector upload url (team scope)
     * @request POST:/api/v1/teams/{teamId}/connectors/publish/upload-url
     */
    v1TeamsConnectorsPublishUploadUrlCreate: (
      teamId: string,
      request: BaseConnectorRegistryUploadURLRequest,
      params: RequestParams = {},
    ) =>
      this.request<BaseConnectorRegistryUploadURLResponse, any>({
        path: `/api/v1/teams/${teamId}/connectors/publish/upload-url`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsConnectorsPublishVersionsDetail
     * @summary List connector versions by team scope
     * @request GET:/api/v1/teams/{teamId}/connectors/publish/versions
     */
    v1TeamsConnectorsPublishVersionsDetail: (
      teamId: string,
      query: {
        /** Connector ID */
        connector_id: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<ArrayBaseConnectorRegistryVersion, any>({
        path: `/api/v1/teams/${teamId}/connectors/publish/versions`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags CronTriggers
     * @name V1TeamsCronTriggersDetail
     * @summary List schedule triggers
     * @request GET:/api/v1/teams/{teamId}/cron-triggers
     */
    v1TeamsCronTriggersDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<VoListCronTriggersResponse, any>({
        path: `/api/v1/teams/${teamId}/cron-triggers`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags CronTriggers
     * @name V1TeamsCronTriggersCreate
     * @summary Create schedule trigger
     * @request POST:/api/v1/teams/{teamId}/cron-triggers
     */
    v1TeamsCronTriggersCreate: (teamId: string, request: VoCreateCronTriggerRequest, params: RequestParams = {}) =>
      this.request<VoCronTrigger, any>({
        path: `/api/v1/teams/${teamId}/cron-triggers`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags CronTriggers
     * @name V1TeamsCronTriggersDetail2
     * @summary Get schedule trigger
     * @request GET:/api/v1/teams/{teamId}/cron-triggers/{triggerId}
     * @originalName v1TeamsCronTriggersDetail
     * @duplicate
     */
    v1TeamsCronTriggersDetail2: (teamId: string, triggerId: string, params: RequestParams = {}) =>
      this.request<VoCronTrigger, any>({
        path: `/api/v1/teams/${teamId}/cron-triggers/${triggerId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags CronTriggers
     * @name V1TeamsCronTriggersPartialUpdate
     * @summary Patch schedule trigger
     * @request PATCH:/api/v1/teams/{teamId}/cron-triggers/{triggerId}
     */
    v1TeamsCronTriggersPartialUpdate: (
      teamId: string,
      triggerId: string,
      request: VoUpdateCronTriggerRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoCronTrigger, any>({
        path: `/api/v1/teams/${teamId}/cron-triggers/${triggerId}`,
        method: "PATCH",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags CronTriggers
     * @name V1TeamsCronTriggersDisableCreate
     * @summary Disable schedule trigger
     * @request POST:/api/v1/teams/{teamId}/cron-triggers/{triggerId}/disable
     */
    v1TeamsCronTriggersDisableCreate: (teamId: string, triggerId: string, params: RequestParams = {}) =>
      this.request<VoCronTrigger, any>({
        path: `/api/v1/teams/${teamId}/cron-triggers/${triggerId}/disable`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags CronTriggers
     * @name V1TeamsCronTriggersEnableCreate
     * @summary Enable schedule trigger
     * @request POST:/api/v1/teams/{teamId}/cron-triggers/{triggerId}/enable
     */
    v1TeamsCronTriggersEnableCreate: (teamId: string, triggerId: string, params: RequestParams = {}) =>
      this.request<VoCronTrigger, any>({
        path: `/api/v1/teams/${teamId}/cron-triggers/${triggerId}/enable`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags CronTriggers
     * @name V1TeamsCronTriggersRunCreate
     * @summary Run schedule trigger now
     * @request POST:/api/v1/teams/{teamId}/cron-triggers/{triggerId}/run
     */
    v1TeamsCronTriggersRunCreate: (teamId: string, triggerId: string, params: RequestParams = {}) =>
      this.request<VoCronTriggerRun, any>({
        path: `/api/v1/teams/${teamId}/cron-triggers/${triggerId}/run`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags CronTriggers
     * @name V1TeamsCronTriggersRunsDetail
     * @summary List schedule trigger runs
     * @request GET:/api/v1/teams/{teamId}/cron-triggers/{triggerId}/runs
     */
    v1TeamsCronTriggersRunsDetail: (teamId: string, triggerId: string, params: RequestParams = {}) =>
      this.request<VoListCronTriggerRunsResponse, any>({
        path: `/api/v1/teams/${teamId}/cron-triggers/${triggerId}/runs`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsDevicesDetail
     * @summary List team devices
     * @request GET:/api/v1/teams/{teamId}/devices
     */
    v1TeamsDevicesDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<VoListTeamDevicesResponse, any>({
        path: `/api/v1/teams/${teamId}/devices`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsDevicesRegisterCreate
     * @summary Register tentacle client in current team
     * @request POST:/api/v1/teams/{teamId}/devices/register
     */
    v1TeamsDevicesRegisterCreate: (teamId: string, request: VoRegisterTeamDeviceRequest, params: RequestParams = {}) =>
      this.request<VoTeamDevice, any>({
        path: `/api/v1/teams/${teamId}/devices/register`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsDevicesDetail2
     * @summary Get team device by id
     * @request GET:/api/v1/teams/{teamId}/devices/{deviceId}
     * @originalName v1TeamsDevicesDetail
     * @duplicate
     */
    v1TeamsDevicesDetail2: (teamId: string, deviceId: string, params: RequestParams = {}) =>
      this.request<VoTeamDevice, any>({
        path: `/api/v1/teams/${teamId}/devices/${deviceId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Roster
     * @name V1TeamsDigiemployeesDetail
     * @summary List digiemployees
     * @request GET:/api/v1/teams/{teamId}/digiemployees
     */
    v1TeamsDigiemployeesDetail: (
      teamId: string,
      query?: {
        /** Search query (employee id / worker id / worker name) */
        query?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListDigiEmployeesResponse, any>({
        path: `/api/v1/teams/${teamId}/digiemployees`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Roster
     * @name V1TeamsDigiemployeesHireCreate
     * @summary Hire digiemployee
     * @request POST:/api/v1/teams/{teamId}/digiemployees/hire
     */
    v1TeamsDigiemployeesHireCreate: (teamId: string, request: VoHireDigiEmployeeRequest, params: RequestParams = {}) =>
      this.request<VoDigiEmployee, any>({
        path: `/api/v1/teams/${teamId}/digiemployees/hire`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Roster
     * @name V1TeamsDigiemployeesDetail2
     * @summary Get digiemployee
     * @request GET:/api/v1/teams/{teamId}/digiemployees/{digiEmployeeId}
     * @originalName v1TeamsDigiemployeesDetail
     * @duplicate
     */
    v1TeamsDigiemployeesDetail2: (teamId: string, digiEmployeeId: string, params: RequestParams = {}) =>
      this.request<VoDigiEmployee, any>({
        path: `/api/v1/teams/${teamId}/digiemployees/${digiEmployeeId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Roster
     * @name V1TeamsDigiemployeesFireCreate
     * @summary Fire digiemployee
     * @request POST:/api/v1/teams/{teamId}/digiemployees/{digiEmployeeId}/fire
     */
    v1TeamsDigiemployeesFireCreate: (teamId: string, digiEmployeeId: string, params: RequestParams = {}) =>
      this.request<MapStringString, any>({
        path: `/api/v1/teams/${teamId}/digiemployees/${digiEmployeeId}/fire`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Roster
     * @name V1TeamsDigiemployeesKbAccessDetail
     * @summary Get digiemployee knowledge base access
     * @request GET:/api/v1/teams/{teamId}/digiemployees/{digiEmployeeId}/kb-access
     */
    v1TeamsDigiemployeesKbAccessDetail: (teamId: string, digiEmployeeId: string, params: RequestParams = {}) =>
      this.request<VoDigiEmployeeKBAccess, any>({
        path: `/api/v1/teams/${teamId}/digiemployees/${digiEmployeeId}/kb-access`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Roster
     * @name V1TeamsDigiemployeesKbAccessUpdate
     * @summary Put digiemployee knowledge base access
     * @request PUT:/api/v1/teams/{teamId}/digiemployees/{digiEmployeeId}/kb-access
     */
    v1TeamsDigiemployeesKbAccessUpdate: (
      teamId: string,
      digiEmployeeId: string,
      request: VoPutDigiEmployeeKBAccessRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoDigiEmployeeKBAccess, any>({
        path: `/api/v1/teams/${teamId}/digiemployees/${digiEmployeeId}/kb-access`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Roster
     * @name V1TeamsDigiemployeesReportingLineUpdate
     * @summary Put digiemployee reporting line
     * @request PUT:/api/v1/teams/{teamId}/digiemployees/{digiEmployeeId}/reporting-line
     */
    v1TeamsDigiemployeesReportingLineUpdate: (
      teamId: string,
      digiEmployeeId: string,
      request: VoPutDigiEmployeeReportingLineRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoDigiEmployee, any>({
        path: `/api/v1/teams/${teamId}/digiemployees/${digiEmployeeId}/reporting-line`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Roster
     * @name V1TeamsDigiemployeesReportingNeighborsDetail
     * @summary Get digiemployee reporting neighbors
     * @request GET:/api/v1/teams/{teamId}/digiemployees/{digiEmployeeId}/reporting-neighbors
     */
    v1TeamsDigiemployeesReportingNeighborsDetail: (
      teamId: string,
      digiEmployeeId: string,
      params: RequestParams = {},
    ) =>
      this.request<VoListReportingNeighborsResponse, any>({
        path: `/api/v1/teams/${teamId}/digiemployees/${digiEmployeeId}/reporting-neighbors`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Roster
     * @name V1TeamsDigiemployeesSkillsetsPartialUpdate
     * @summary Patch digiemployee skillsets (team user, team-scoped)
     * @request PATCH:/api/v1/teams/{teamId}/digiemployees/{digiEmployeeId}/skillsets
     */
    v1TeamsDigiemployeesSkillsetsPartialUpdate: (
      teamId: string,
      digiEmployeeId: string,
      request: VoPatchDigiEmployeeSkillsetsRequest,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoDigiEmployee, BasePinErr>({
        path: `/api/v1/teams/${teamId}/digiemployees/${digiEmployeeId}/skillsets`,
        method: "PATCH",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Stations
     * @name V1TeamsDigiemployeesStationsDetail
     * @summary List stations for a digiemployee
     * @request GET:/api/v1/teams/{teamId}/digiemployees/{digiEmployeeId}/stations
     */
    v1TeamsDigiemployeesStationsDetail: (teamId: string, digiEmployeeId: string, params: RequestParams = {}) =>
      this.request<VoListStationsResponse, any>({
        path: `/api/v1/teams/${teamId}/digiemployees/${digiEmployeeId}/stations`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Stations
     * @name V1TeamsDigiemployeesStationsCreate
     * @summary Create station for a digiemployee
     * @request POST:/api/v1/teams/{teamId}/digiemployees/{digiEmployeeId}/stations
     */
    v1TeamsDigiemployeesStationsCreate: (
      teamId: string,
      digiEmployeeId: string,
      request: VoCreateStationRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoStation, any>({
        path: `/api/v1/teams/${teamId}/digiemployees/${digiEmployeeId}/stations`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Roster
     * @name V1TeamsDigiemployeesTeamSkillsDetail
     * @summary Get digiemployee team skills
     * @request GET:/api/v1/teams/{teamId}/digiemployees/{digiEmployeeId}/team-skills
     */
    v1TeamsDigiemployeesTeamSkillsDetail: (teamId: string, digiEmployeeId: string, params: RequestParams = {}) =>
      this.request<BasePinOKVoGetDigiEmployeeTeamSkillsResponse, BasePinErr>({
        path: `/api/v1/teams/${teamId}/digiemployees/${digiEmployeeId}/team-skills`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Roster
     * @name V1TeamsDigiemployeesTeamSkillsUpdate
     * @summary Put digiemployee team skills
     * @request PUT:/api/v1/teams/{teamId}/digiemployees/{digiEmployeeId}/team-skills
     */
    v1TeamsDigiemployeesTeamSkillsUpdate: (
      teamId: string,
      digiEmployeeId: string,
      request: VoPutDigiEmployeeTeamSkillsRequest,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoGetDigiEmployeeTeamSkillsResponse, BasePinErr>({
        path: `/api/v1/teams/${teamId}/digiemployees/${digiEmployeeId}/team-skills`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags ExternalUserVerificationFlows
     * @name V1TeamsExternalUserTagsDetail
     * @summary List team external user tags
     * @request GET:/api/v1/teams/{teamId}/external-user-tags
     */
    v1TeamsExternalUserTagsDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<VoListTeamExternalUserTagsResponse, any>({
        path: `/api/v1/teams/${teamId}/external-user-tags`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags ExternalUserVerificationFlows
     * @name V1TeamsExternalUserVerificationFlowsDetail
     * @summary List team external user verification flows
     * @request GET:/api/v1/teams/{teamId}/external-user-verification-flows
     */
    v1TeamsExternalUserVerificationFlowsDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<VoListExternalUserVerificationFlowsResponse, any>({
        path: `/api/v1/teams/${teamId}/external-user-verification-flows`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags ExternalUserVerificationFlows
     * @name V1TeamsExternalUserVerificationFlowsCreate
     * @summary Create team external user verification flow
     * @request POST:/api/v1/teams/{teamId}/external-user-verification-flows
     */
    v1TeamsExternalUserVerificationFlowsCreate: (
      teamId: string,
      request: VoUpsertExternalUserVerificationFlowRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoExternalUserVerificationFlowDetail, any>({
        path: `/api/v1/teams/${teamId}/external-user-verification-flows`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags ExternalUserVerificationFlows
     * @name V1TeamsExternalUserVerificationFlowsDetail2
     * @summary Get team external user verification flow
     * @request GET:/api/v1/teams/{teamId}/external-user-verification-flows/{flowId}
     * @originalName v1TeamsExternalUserVerificationFlowsDetail
     * @duplicate
     */
    v1TeamsExternalUserVerificationFlowsDetail2: (teamId: string, flowId: string, params: RequestParams = {}) =>
      this.request<VoExternalUserVerificationFlowDetail, any>({
        path: `/api/v1/teams/${teamId}/external-user-verification-flows/${flowId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags ExternalUserVerificationFlows
     * @name V1TeamsExternalUserVerificationFlowsUpdate
     * @summary Update team external user verification flow
     * @request PUT:/api/v1/teams/{teamId}/external-user-verification-flows/{flowId}
     */
    v1TeamsExternalUserVerificationFlowsUpdate: (
      teamId: string,
      flowId: string,
      request: VoUpsertExternalUserVerificationFlowRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoExternalUserVerificationFlowDetail, any>({
        path: `/api/v1/teams/${teamId}/external-user-verification-flows/${flowId}`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags ExternalUserVerificationFlows
     * @name V1TeamsExternalUserVerificationFlowsDelete
     * @summary Delete team external user verification flow
     * @request DELETE:/api/v1/teams/{teamId}/external-user-verification-flows/{flowId}
     */
    v1TeamsExternalUserVerificationFlowsDelete: (teamId: string, flowId: string, params: RequestParams = {}) =>
      this.request<VoDeleteExternalUserVerificationFlowResponse, any>({
        path: `/api/v1/teams/${teamId}/external-user-verification-flows/${flowId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags ExternalUsers
     * @name V1TeamsExternalUsersDetail
     * @summary List team external users
     * @request GET:/api/v1/teams/{teamId}/external-users
     */
    v1TeamsExternalUsersDetail: (
      teamId: string,
      query?: {
        /** Query by externalUserId or channelUserId */
        query?: string;
        /** Filter by channel */
        channel?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListExternalUsersResponse, any>({
        path: `/api/v1/teams/${teamId}/external-users`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags ExternalUsers
     * @name V1TeamsExternalUsersDetail2
     * @summary Get team external user detail
     * @request GET:/api/v1/teams/{teamId}/external-users/{externalUserId}
     * @originalName v1TeamsExternalUsersDetail
     * @duplicate
     */
    v1TeamsExternalUsersDetail2: (teamId: string, externalUserId: string, params: RequestParams = {}) =>
      this.request<VoExternalUserDetail, any>({
        path: `/api/v1/teams/${teamId}/external-users/${externalUserId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags ExternalUsers
     * @name V1TeamsExternalUsersConversationsDetail
     * @summary List conversations under a team external user
     * @request GET:/api/v1/teams/{teamId}/external-users/{externalUserId}/conversations
     */
    v1TeamsExternalUsersConversationsDetail: (teamId: string, externalUserId: string, params: RequestParams = {}) =>
      this.request<VoListExternalUserConversationsResponse, any>({
        path: `/api/v1/teams/${teamId}/external-users/${externalUserId}/conversations`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsFilesDeleteCreate
     * @summary Delete team root files (team user)
     * @request POST:/api/v1/teams/{teamId}/files/delete
     */
    v1TeamsFilesDeleteCreate: (teamId: string, request: VoTeamDeleteRequest, params: RequestParams = {}) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/api/v1/teams/${teamId}/files/delete`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsFilesEntriesDetail
     * @summary Browse team root file entries (team user)
     * @request GET:/api/v1/teams/{teamId}/files/entries
     */
    v1TeamsFilesEntriesDetail: (
      teamId: string,
      query: {
        /** root kind */
        rootKind: string;
        /** case ident */
        caseIdent?: string;
        /** external user id */
        externalUserId?: string;
        /** conversation id */
        conversationId?: string;
        /** upload id */
        uploadId?: string;
        /** directory prefix */
        prefix?: string;
        /** pagination cursor */
        cursor?: string;
        /** page size (<=200) */
        limit?: number;
        /** search direct children by name */
        q?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListTeamStorageEntriesResponse, any>({
        path: `/api/v1/teams/${teamId}/files/entries`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsFilesMountsDetail
     * @summary List team root file mounts (team user)
     * @request GET:/api/v1/teams/{teamId}/files/mounts
     */
    v1TeamsFilesMountsDetail: (
      teamId: string,
      query: {
        /** root kind */
        rootKind: string;
        /** case ident */
        caseIdent?: string;
        /** external user id */
        externalUserId?: string;
        /** conversation id */
        conversationId?: string;
        /** upload id */
        uploadId?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListTeamStorageMountsResponse, any>({
        path: `/api/v1/teams/${teamId}/files/mounts`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsFilesMoveCreate
     * @summary Move team root files (team user)
     * @request POST:/api/v1/teams/{teamId}/files/move
     */
    v1TeamsFilesMoveCreate: (teamId: string, request: VoTeamMoveRequest, params: RequestParams = {}) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/api/v1/teams/${teamId}/files/move`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsFilesPresignGetCreate
     * @summary Presign GET for team root file (team user)
     * @request POST:/api/v1/teams/{teamId}/files/presign-get
     */
    v1TeamsFilesPresignGetCreate: (teamId: string, request: VoTeamPresignRequest, params: RequestParams = {}) =>
      this.request<VoTeamPresignResponse, any>({
        path: `/api/v1/teams/${teamId}/files/presign-get`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsFilesPresignPutCreate
     * @summary Presign PUT for team root file (team user)
     * @request POST:/api/v1/teams/{teamId}/files/presign-put
     */
    v1TeamsFilesPresignPutCreate: (teamId: string, request: VoTeamPresignRequest, params: RequestParams = {}) =>
      this.request<VoTeamPresignResponse, any>({
        path: `/api/v1/teams/${teamId}/files/presign-put`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsFilesUploadFinalizeCreate
     * @summary Finalize uploaded team root file (team user)
     * @request POST:/api/v1/teams/{teamId}/files/upload-finalize
     */
    v1TeamsFilesUploadFinalizeCreate: (
      teamId: string,
      request: VoTeamUploadFinalizeRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoTeamUploadFinalizeResponse, any>({
        path: `/api/v1/teams/${teamId}/files/upload-finalize`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Inbox
     * @name V1TeamsInboxItemsActCreate
     * @summary Act on inbox item
     * @request POST:/api/v1/teams/{teamId}/inbox/items/{itemId}/act
     */
    v1TeamsInboxItemsActCreate: (teamId: string, itemId: string, request: VoActRequest, params: RequestParams = {}) =>
      this.request<VoActResponse, any>({
        path: `/api/v1/teams/${teamId}/inbox/items/${itemId}/act`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Inbox
     * @name V1TeamsInboxSummaryDetail
     * @summary Get inbox summary
     * @request GET:/api/v1/teams/{teamId}/inbox/summary
     */
    v1TeamsInboxSummaryDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<VoInboxSummary, any>({
        path: `/api/v1/teams/${teamId}/inbox/summary`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Integrations
     * @name V1TeamsIntegrationsDetail
     * @summary List team integrations
     * @request GET:/api/v1/teams/{teamId}/integrations
     */
    v1TeamsIntegrationsDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<VoListIntegrationsResponse, any>({
        path: `/api/v1/teams/${teamId}/integrations`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Integrations
     * @name V1TeamsIntegrationsFeishuUpdate
     * @summary Create or update feishu integration
     * @request PUT:/api/v1/teams/{teamId}/integrations/feishu
     */
    v1TeamsIntegrationsFeishuUpdate: (
      teamId: string,
      body: VoUpsertFeishuIntegrationRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoTeamIntegrationVO, any>({
        path: `/api/v1/teams/${teamId}/integrations/feishu`,
        method: "PUT",
        body: body,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Integrations
     * @name V1TeamsIntegrationsFeishuDelete
     * @summary Delete feishu integration
     * @request DELETE:/api/v1/teams/{teamId}/integrations/feishu
     */
    v1TeamsIntegrationsFeishuDelete: (teamId: string, params: RequestParams = {}) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/api/v1/teams/${teamId}/integrations/feishu`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Integrations
     * @name V1TeamsIntegrationsFeishuVerifyCreate
     * @summary Verify feishu credentials (read-only, no DB write)
     * @request POST:/api/v1/teams/{teamId}/integrations/feishu/verify
     */
    v1TeamsIntegrationsFeishuVerifyCreate: (teamId: string, body: VoVerifyFeishuRequest, params: RequestParams = {}) =>
      this.request<VoVerifyFeishuResponse, any>({
        path: `/api/v1/teams/${teamId}/integrations/feishu/verify`,
        method: "POST",
        body: body,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Integrations
     * @name V1TeamsIntegrationsWecomUpdate
     * @summary Update wecom integration config
     * @request PUT:/api/v1/teams/{teamId}/integrations/wecom
     */
    v1TeamsIntegrationsWecomUpdate: (
      teamId: string,
      body: VoUpdateWecomIntegrationRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoTeamIntegrationVO, any>({
        path: `/api/v1/teams/${teamId}/integrations/wecom`,
        method: "PUT",
        body: body,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Integrations
     * @name V1TeamsIntegrationsWecomCreate
     * @summary Create or overwrite wecom integration config
     * @request POST:/api/v1/teams/{teamId}/integrations/wecom
     */
    v1TeamsIntegrationsWecomCreate: (
      teamId: string,
      body: VoCreateWecomIntegrationRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoTeamIntegrationVO, any>({
        path: `/api/v1/teams/${teamId}/integrations/wecom`,
        method: "POST",
        body: body,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Integrations
     * @name V1TeamsIntegrationsWecomDelete
     * @summary Delete wecom integration
     * @request DELETE:/api/v1/teams/{teamId}/integrations/wecom
     */
    v1TeamsIntegrationsWecomDelete: (teamId: string, params: RequestParams = {}) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/api/v1/teams/${teamId}/integrations/wecom`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Integrations
     * @name V1TeamsIntegrationsWecomContactsDetail
     * @summary List wecom contacts (local cache)
     * @request GET:/api/v1/teams/{teamId}/integrations/wecom/contacts
     */
    v1TeamsIntegrationsWecomContactsDetail: (
      teamId: string,
      query?: {
        /** Name keyword */
        q?: string;
        /** Page (default 1) */
        page?: number;
        /** Page size (default 20) */
        pageSize?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListWecomContactsResponse, any>({
        path: `/api/v1/teams/${teamId}/integrations/wecom/contacts`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Integrations
     * @name V1TeamsIntegrationsWecomSyncContactsCreate
     * @summary Trigger wecom contacts sync (async)
     * @request POST:/api/v1/teams/{teamId}/integrations/wecom/sync-contacts
     */
    v1TeamsIntegrationsWecomSyncContactsCreate: (teamId: string, params: RequestParams = {}) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/api/v1/teams/${teamId}/integrations/wecom/sync-contacts`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Integrations
     * @name V1TeamsIntegrationsWecomVerifyCreate
     * @summary Verify wecom credentials (read-only, no DB write)
     * @request POST:/api/v1/teams/{teamId}/integrations/wecom/verify
     */
    v1TeamsIntegrationsWecomVerifyCreate: (teamId: string, body: VoVerifyWecomRequest, params: RequestParams = {}) =>
      this.request<VoVerifyWecomResponse, any>({
        path: `/api/v1/teams/${teamId}/integrations/wecom/verify`,
        method: "POST",
        body: body,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsJobTagsSelectableDetail
     * @summary List selectable job tags for hire page
     * @request GET:/api/v1/teams/{teamId}/job-tags/selectable
     */
    v1TeamsJobTagsSelectableDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<BasePinOKVoListSelectableJobTagsResponse, BasePinErr>({
        path: `/api/v1/teams/${teamId}/job-tags/selectable`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Jobs
     * @name V1TeamsJobsDetail
     * @summary List jobs
     * @request GET:/api/v1/teams/{teamId}/jobs
     */
    v1TeamsJobsDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<VoListJobsResponse, any>({
        path: `/api/v1/teams/${teamId}/jobs`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Jobs
     * @name V1TeamsJobsCreate
     * @summary Create job
     * @request POST:/api/v1/teams/{teamId}/jobs
     */
    v1TeamsJobsCreate: (teamId: string, request: VoCreateJobRequest, params: RequestParams = {}) =>
      this.request<VoJob, any>({
        path: `/api/v1/teams/${teamId}/jobs`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Jobs
     * @name V1TeamsJobsDetail2
     * @summary Get job
     * @request GET:/api/v1/teams/{teamId}/jobs/{jobId}
     * @originalName v1TeamsJobsDetail
     * @duplicate
     */
    v1TeamsJobsDetail2: (teamId: string, jobId: string, params: RequestParams = {}) =>
      this.request<VoJob, any>({
        path: `/api/v1/teams/${teamId}/jobs/${jobId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Jobs
     * @name V1TeamsJobsCancelCreate
     * @summary Cancel job
     * @request POST:/api/v1/teams/{teamId}/jobs/{jobId}/cancel
     */
    v1TeamsJobsCancelCreate: (teamId: string, jobId: string, params: RequestParams = {}) =>
      this.request<VoJob, any>({
        path: `/api/v1/teams/${teamId}/jobs/${jobId}/cancel`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Jobs
     * @name V1TeamsJobsStartCreate
     * @summary Start job
     * @request POST:/api/v1/teams/{teamId}/jobs/{jobId}/start
     */
    v1TeamsJobsStartCreate: (teamId: string, jobId: string, params: RequestParams = {}) =>
      this.request<VoJob, any>({
        path: `/api/v1/teams/${teamId}/jobs/${jobId}/start`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsKbDirectoriesDetail
     * @summary List team kb directories
     * @request GET:/api/v1/teams/{teamId}/kb/directories
     */
    v1TeamsKbDirectoriesDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<VoListTeamKbDirectoriesResponse, any>({
        path: `/api/v1/teams/${teamId}/kb/directories`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsKbDirectoriesCreate
     * @summary Create team kb directory
     * @request POST:/api/v1/teams/{teamId}/kb/directories
     */
    v1TeamsKbDirectoriesCreate: (teamId: string, request: VoCreateTeamKbDirectoryRequest, params: RequestParams = {}) =>
      this.request<VoTeamKbDirectory, any>({
        path: `/api/v1/teams/${teamId}/kb/directories`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsKbSyncBindingsDetail
     * @summary List team kb sync bindings
     * @request GET:/api/v1/teams/{teamId}/kb/sync-bindings
     */
    v1TeamsKbSyncBindingsDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<VoListTeamKbSyncBindingsResponse, any>({
        path: `/api/v1/teams/${teamId}/kb/sync-bindings`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsKbSyncBindingsCreate
     * @summary Create team kb sync binding
     * @request POST:/api/v1/teams/{teamId}/kb/sync-bindings
     */
    v1TeamsKbSyncBindingsCreate: (
      teamId: string,
      request: VoCreateTeamKbSyncBindingRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoTeamKbSyncBinding, any>({
        path: `/api/v1/teams/${teamId}/kb/sync-bindings`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsKbSyncBindingsValidateTargetCreate
     * @summary Validate kb sync target directory
     * @request POST:/api/v1/teams/{teamId}/kb/sync-bindings/validate-target
     */
    v1TeamsKbSyncBindingsValidateTargetCreate: (
      teamId: string,
      request: VoValidateTeamKbSyncTargetRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoValidateTeamKbSyncTargetResponse, any>({
        path: `/api/v1/teams/${teamId}/kb/sync-bindings/validate-target`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsKbSyncBindingsDelete
     * @summary Delete team kb sync binding
     * @request DELETE:/api/v1/teams/{teamId}/kb/sync-bindings/{bindingId}
     */
    v1TeamsKbSyncBindingsDelete: (teamId: string, bindingId: string, params: RequestParams = {}) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/api/v1/teams/${teamId}/kb/sync-bindings/${bindingId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsKbSyncBootstrapAccessCreate
     * @summary Issue file gateway bootstrap access for tentacle kb sync
     * @request POST:/api/v1/teams/{teamId}/kb/sync-bootstrap-access
     */
    v1TeamsKbSyncBootstrapAccessCreate: (
      teamId: string,
      request: VoTeamKbSyncBootstrapAccessRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoTeamKbSyncBootstrapAccessResponse, any>({
        path: `/api/v1/teams/${teamId}/kb/sync-bootstrap-access`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsKbSyncJobsDetail
     * @summary List team kb sync jobs
     * @request GET:/api/v1/teams/{teamId}/kb/sync-jobs
     */
    v1TeamsKbSyncJobsDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<VoListTeamKbSyncJobsResponse, any>({
        path: `/api/v1/teams/${teamId}/kb/sync-jobs`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsLinktoolLoginCodesCreate
     * @summary Issue linktool login code for team scope
     * @request POST:/api/v1/teams/{teamId}/linktool-login/codes
     */
    v1TeamsLinktoolLoginCodesCreate: (teamId: string, params: RequestParams = {}) =>
      this.request<VoLinktoolLoginCodeIssueResponse, any>({
        path: `/api/v1/teams/${teamId}/linktool-login/codes`,
        method: "POST",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsMcpTunnelsDetail
     * @summary List team mcp tunnels
     * @request GET:/api/v1/teams/{teamId}/mcp-tunnels
     */
    v1TeamsMcpTunnelsDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<VoListTeamMcpTunnelsResponse, any>({
        path: `/api/v1/teams/${teamId}/mcp-tunnels`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsMcpTunnelsCreate
     * @summary Create team mcp tunnel
     * @request POST:/api/v1/teams/{teamId}/mcp-tunnels
     */
    v1TeamsMcpTunnelsCreate: (teamId: string, request: VoCreateTeamMcpTunnelRequest, params: RequestParams = {}) =>
      this.request<VoTeamMcpTunnel, any>({
        path: `/api/v1/teams/${teamId}/mcp-tunnels`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsMcpTunnelsDetail2
     * @summary Get team mcp tunnel by id
     * @request GET:/api/v1/teams/{teamId}/mcp-tunnels/{mcpTunnelId}
     * @originalName v1TeamsMcpTunnelsDetail
     * @duplicate
     */
    v1TeamsMcpTunnelsDetail2: (teamId: string, mcpTunnelId: string, params: RequestParams = {}) =>
      this.request<VoTeamMcpTunnel, any>({
        path: `/api/v1/teams/${teamId}/mcp-tunnels/${mcpTunnelId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsMcpTunnelsDelete
     * @summary Delete team mcp tunnel
     * @request DELETE:/api/v1/teams/{teamId}/mcp-tunnels/{mcpTunnelId}
     */
    v1TeamsMcpTunnelsDelete: (teamId: string, mcpTunnelId: string, params: RequestParams = {}) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/api/v1/teams/${teamId}/mcp-tunnels/${mcpTunnelId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsMcpTunnelsPartialUpdate
     * @summary Patch team mcp tunnel
     * @request PATCH:/api/v1/teams/{teamId}/mcp-tunnels/{mcpTunnelId}
     */
    v1TeamsMcpTunnelsPartialUpdate: (
      teamId: string,
      mcpTunnelId: string,
      request: VoPatchTeamMcpTunnelRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoTeamMcpTunnel, any>({
        path: `/api/v1/teams/${teamId}/mcp-tunnels/${mcpTunnelId}`,
        method: "PATCH",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsMcpTunnelsActivateCreate
     * @summary Activate team mcp tunnel
     * @request POST:/api/v1/teams/{teamId}/mcp-tunnels/{mcpTunnelId}/activate
     */
    v1TeamsMcpTunnelsActivateCreate: (teamId: string, mcpTunnelId: string, params: RequestParams = {}) =>
      this.request<VoTeamMcpTunnel, any>({
        path: `/api/v1/teams/${teamId}/mcp-tunnels/${mcpTunnelId}/activate`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsMcpTunnelsBindingsDetail
     * @summary List team mcp tunnel bindings
     * @request GET:/api/v1/teams/{teamId}/mcp-tunnels/{mcpTunnelId}/bindings
     */
    v1TeamsMcpTunnelsBindingsDetail: (teamId: string, mcpTunnelId: string, params: RequestParams = {}) =>
      this.request<VoListTeamMcpTunnelBindingsResponse, any>({
        path: `/api/v1/teams/${teamId}/mcp-tunnels/${mcpTunnelId}/bindings`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsMcpTunnelsDeactivateCreate
     * @summary Deactivate team mcp tunnel
     * @request POST:/api/v1/teams/{teamId}/mcp-tunnels/{mcpTunnelId}/deactivate
     */
    v1TeamsMcpTunnelsDeactivateCreate: (teamId: string, mcpTunnelId: string, params: RequestParams = {}) =>
      this.request<VoTeamMcpTunnel, any>({
        path: `/api/v1/teams/${teamId}/mcp-tunnels/${mcpTunnelId}/deactivate`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsMeProfileDetail
     * @summary Get current user team membership profile
     * @request GET:/api/v1/teams/{teamId}/me/profile
     */
    v1TeamsMeProfileDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<VoTeamMembershipProfile, any>({
        path: `/api/v1/teams/${teamId}/me/profile`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsMeProfilePartialUpdate
     * @summary Update current user team membership profile
     * @request PATCH:/api/v1/teams/{teamId}/me/profile
     */
    v1TeamsMeProfilePartialUpdate: (
      teamId: string,
      request: VoPatchTeamMembershipProfileRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoTeamMembershipProfile, any>({
        path: `/api/v1/teams/${teamId}/me/profile`,
        method: "PATCH",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsMembersDetail
     * @summary List team members
     * @request GET:/api/v1/teams/{teamId}/members
     */
    v1TeamsMembersDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<VoListTeamMembersResponse, any>({
        path: `/api/v1/teams/${teamId}/members`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsMembersProfileDetail
     * @summary Get team member profile
     * @request GET:/api/v1/teams/{teamId}/members/{userId}/profile
     */
    v1TeamsMembersProfileDetail: (teamId: string, userId: string, params: RequestParams = {}) =>
      this.request<VoTeamMembershipProfile, any>({
        path: `/api/v1/teams/${teamId}/members/${userId}/profile`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsMembersProfilePartialUpdate
     * @summary Update team member profile
     * @request PATCH:/api/v1/teams/{teamId}/members/{userId}/profile
     */
    v1TeamsMembersProfilePartialUpdate: (
      teamId: string,
      userId: string,
      request: VoPatchTeamMembershipProfileRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoTeamMembershipProfile, any>({
        path: `/api/v1/teams/${teamId}/members/${userId}/profile`,
        method: "PATCH",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Roster
     * @name V1TeamsPinnedDigiemployeesDetail
     * @summary List pinned digiemployees for current user in team
     * @request GET:/api/v1/teams/{teamId}/pinned-digiemployees
     */
    v1TeamsPinnedDigiemployeesDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<VoListPinnedDigiEmployeesResponse, any>({
        path: `/api/v1/teams/${teamId}/pinned-digiemployees`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Roster
     * @name V1TeamsPinnedDigiemployeesUpdate
     * @summary Pin a digiemployee for current user in team
     * @request PUT:/api/v1/teams/{teamId}/pinned-digiemployees/{digiEmployeeId}
     */
    v1TeamsPinnedDigiemployeesUpdate: (teamId: string, digiEmployeeId: string, params: RequestParams = {}) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/api/v1/teams/${teamId}/pinned-digiemployees/${digiEmployeeId}`,
        method: "PUT",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Roster
     * @name V1TeamsPinnedDigiemployeesDelete
     * @summary Unpin a digiemployee for current user in team
     * @request DELETE:/api/v1/teams/{teamId}/pinned-digiemployees/{digiEmployeeId}
     */
    v1TeamsPinnedDigiemployeesDelete: (teamId: string, digiEmployeeId: string, params: RequestParams = {}) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/api/v1/teams/${teamId}/pinned-digiemployees/${digiEmployeeId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsRemoteTaskConnectionsDetail
     * @summary List remote-task connections (team scope)
     * @request GET:/api/v1/teams/{teamId}/remote-task/connections
     */
    v1TeamsRemoteTaskConnectionsDetail: (
      teamId: string,
      query?: {
        /** Limit */
        limit?: number;
        /** Offset */
        offset?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseRemoteTaskConnectionListResponse, BasePinErr>({
        path: `/api/v1/teams/${teamId}/remote-task/connections`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsRemoteTaskConnectionsCreate
     * @summary Create remote-task connection from connector instance (team scope)
     * @request POST:/api/v1/teams/{teamId}/remote-task/connections
     */
    v1TeamsRemoteTaskConnectionsCreate: (
      teamId: string,
      request: BaseRemoteTaskCreateConnectionRequest,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseRemoteTaskConnection, BasePinErr>({
        path: `/api/v1/teams/${teamId}/remote-task/connections`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsRemoteTaskConnectionsDetail2
     * @summary Get remote-task connection detail (team scope)
     * @request GET:/api/v1/teams/{teamId}/remote-task/connections/{connectionId}
     * @originalName v1TeamsRemoteTaskConnectionsDetail
     * @duplicate
     */
    v1TeamsRemoteTaskConnectionsDetail2: (teamId: string, connectionId: string, params: RequestParams = {}) =>
      this.request<BasePinOKBaseRemoteTaskConnection, BasePinErr>({
        path: `/api/v1/teams/${teamId}/remote-task/connections/${connectionId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsRemoteTaskConnectionsDelete
     * @summary Delete remote-task connection (team scope)
     * @request DELETE:/api/v1/teams/{teamId}/remote-task/connections/{connectionId}
     */
    v1TeamsRemoteTaskConnectionsDelete: (teamId: string, connectionId: string, params: RequestParams = {}) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/api/v1/teams/${teamId}/remote-task/connections/${connectionId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsRemoteTaskConnectionsActionsDetail
     * @summary Get remote-task connection action detail (team scope)
     * @request GET:/api/v1/teams/{teamId}/remote-task/connections/{connectionId}/actions/{actionKey}
     */
    v1TeamsRemoteTaskConnectionsActionsDetail: (
      teamId: string,
      connectionId: string,
      actionKey: string,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseRemoteTaskConnectionActionDetail, BasePinErr>({
        path: `/api/v1/teams/${teamId}/remote-task/connections/${connectionId}/actions/${actionKey}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsRemoteTaskConnectionsActionsExecuteCreate
     * @summary Execute remote-task connection action (team scope)
     * @request POST:/api/v1/teams/{teamId}/remote-task/connections/{connectionId}/actions/{actionKey}/execute
     */
    v1TeamsRemoteTaskConnectionsActionsExecuteCreate: (
      teamId: string,
      connectionId: string,
      actionKey: string,
      request: BaseJSONMap,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseRemoteTaskExecuteActionResponse, BasePinErr>({
        path: `/api/v1/teams/${teamId}/remote-task/connections/${connectionId}/actions/${actionKey}/execute`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsRemoteTaskConnectionsReauthCreate
     * @summary Start remote-task connection reauth (team scope)
     * @request POST:/api/v1/teams/{teamId}/remote-task/connections/{connectionId}/reauth
     */
    v1TeamsRemoteTaskConnectionsReauthCreate: (teamId: string, connectionId: string, params: RequestParams = {}) =>
      this.request<BasePinOKBaseRemoteTaskStartAuthResponse, BasePinErr>({
        path: `/api/v1/teams/${teamId}/remote-task/connections/${connectionId}/reauth`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsRemoteTaskConnectorsDetail
     * @summary List remote-task visible connector instances (team scope)
     * @request GET:/api/v1/teams/{teamId}/remote-task/connectors
     */
    v1TeamsRemoteTaskConnectorsDetail: (
      teamId: string,
      query?: {
        /** Exclude connected connectors */
        exclude_connected?: boolean;
        /** Limit */
        limit?: number;
        /** Offset */
        offset?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseRemoteTaskConnectorListResponse, BasePinErr>({
        path: `/api/v1/teams/${teamId}/remote-task/connectors`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsRemoteTaskConnectorsDetail2
     * @summary Get remote-task connector instance detail (team scope)
     * @request GET:/api/v1/teams/{teamId}/remote-task/connectors/{connectorId}
     * @originalName v1TeamsRemoteTaskConnectorsDetail
     * @duplicate
     */
    v1TeamsRemoteTaskConnectorsDetail2: (teamId: string, connectorId: string, params: RequestParams = {}) =>
      this.request<BasePinOKBaseRemoteTaskConnector, BasePinErr>({
        path: `/api/v1/teams/${teamId}/remote-task/connectors/${connectorId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsRemoteTaskInstancesDetail
     * @summary List remote-task connector instances (team scope)
     * @request GET:/api/v1/teams/{teamId}/remote-task/instances
     */
    v1TeamsRemoteTaskInstancesDetail: (
      teamId: string,
      query?: {
        /** Instance status */
        status?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKArrayBaseRemoteTaskConnectorInstance, BasePinErr>({
        path: `/api/v1/teams/${teamId}/remote-task/instances`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsRemoteTaskInstancesCreate
     * @summary Create remote-task connector instance (team scope)
     * @request POST:/api/v1/teams/{teamId}/remote-task/instances
     */
    v1TeamsRemoteTaskInstancesCreate: (
      teamId: string,
      request: BaseRemoteTaskCreateInstanceRequest,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseRemoteTaskConnectorInstance, BasePinErr>({
        path: `/api/v1/teams/${teamId}/remote-task/instances`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsRemoteTaskInstancesDetail2
     * @summary Get remote-task connector instance detail (team scope)
     * @request GET:/api/v1/teams/{teamId}/remote-task/instances/{instanceId}
     * @originalName v1TeamsRemoteTaskInstancesDetail
     * @duplicate
     */
    v1TeamsRemoteTaskInstancesDetail2: (teamId: string, instanceId: string, params: RequestParams = {}) =>
      this.request<BasePinOKBaseRemoteTaskConnectorInstance, BasePinErr>({
        path: `/api/v1/teams/${teamId}/remote-task/instances/${instanceId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsRemoteTaskInstancesUpdate
     * @summary Update remote-task connector instance (team scope)
     * @request PUT:/api/v1/teams/{teamId}/remote-task/instances/{instanceId}
     */
    v1TeamsRemoteTaskInstancesUpdate: (
      teamId: string,
      instanceId: string,
      request: BaseRemoteTaskCreateInstanceRequest,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseRemoteTaskConnectorInstance, BasePinErr>({
        path: `/api/v1/teams/${teamId}/remote-task/instances/${instanceId}`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsRemoteTaskPackagesDetail
     * @summary List remote-task connector packages (team scope)
     * @request GET:/api/v1/teams/{teamId}/remote-task/packages
     */
    v1TeamsRemoteTaskPackagesDetail: (
      teamId: string,
      query?: {
        /** Package status */
        status?: string;
        /** Package visibility */
        visibility?: string;
        /** Author ID */
        author_id?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseRemoteTaskConnectorPackageListResponse, BasePinErr>({
        path: `/api/v1/teams/${teamId}/remote-task/packages`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsRemoteTaskPackagesDetail2
     * @summary Get remote-task connector package detail (team scope)
     * @request GET:/api/v1/teams/{teamId}/remote-task/packages/{pkgId}
     * @originalName v1TeamsRemoteTaskPackagesDetail
     * @duplicate
     */
    v1TeamsRemoteTaskPackagesDetail2: (teamId: string, pkgId: string, params: RequestParams = {}) =>
      this.request<BasePinOKBaseRemoteTaskConnectorPackageDetail, BasePinErr>({
        path: `/api/v1/teams/${teamId}/remote-task/packages/${pkgId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsRemoteTaskPackagesInstancesDetail
     * @summary List remote-task connector package instances (team scope)
     * @request GET:/api/v1/teams/{teamId}/remote-task/packages/{pkgId}/instances
     */
    v1TeamsRemoteTaskPackagesInstancesDetail: (teamId: string, pkgId: string, params: RequestParams = {}) =>
      this.request<BasePinOKArrayBaseRemoteTaskConnectorInstance, BasePinErr>({
        path: `/api/v1/teams/${teamId}/remote-task/packages/${pkgId}/instances`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsRemoteTaskPackagesVersionsDetail
     * @summary List remote-task connector package versions (team scope)
     * @request GET:/api/v1/teams/{teamId}/remote-task/packages/{pkgId}/versions
     */
    v1TeamsRemoteTaskPackagesVersionsDetail: (teamId: string, pkgId: string, params: RequestParams = {}) =>
      this.request<BasePinOKArrayBaseRemoteTaskPackageVersion, BasePinErr>({
        path: `/api/v1/teams/${teamId}/remote-task/packages/${pkgId}/versions`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsRemoteTaskTasksDetail
     * @summary List remote-task executions (team scope)
     * @request GET:/api/v1/teams/{teamId}/remote-task/tasks
     */
    v1TeamsRemoteTaskTasksDetail: (
      teamId: string,
      query?: {
        /** Limit */
        limit?: number;
        /** Offset */
        offset?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseRemoteTaskExecutionListResponse, BasePinErr>({
        path: `/api/v1/teams/${teamId}/remote-task/tasks`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsRemoteTaskTasksDetail2
     * @summary Get remote-task execution detail (team scope)
     * @request GET:/api/v1/teams/{teamId}/remote-task/tasks/{taskId}
     * @originalName v1TeamsRemoteTaskTasksDetail
     * @duplicate
     */
    v1TeamsRemoteTaskTasksDetail2: (teamId: string, taskId: string, params: RequestParams = {}) =>
      this.request<BasePinOKBaseRemoteTaskExecution, BasePinErr>({
        path: `/api/v1/teams/${teamId}/remote-task/tasks/${taskId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsRemoteTaskTasksDelete
     * @summary Delete remote-task execution (team scope)
     * @request DELETE:/api/v1/teams/{teamId}/remote-task/tasks/{taskId}
     */
    v1TeamsRemoteTaskTasksDelete: (teamId: string, taskId: string, params: RequestParams = {}) =>
      this.request<BasePinOKVoRemoteTaskDeleteResponse, BasePinErr>({
        path: `/api/v1/teams/${teamId}/remote-task/tasks/${taskId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsRemoteTaskTasksCancelCreate
     * @summary Cancel remote-task execution (team scope)
     * @request POST:/api/v1/teams/{teamId}/remote-task/tasks/{taskId}/cancel
     */
    v1TeamsRemoteTaskTasksCancelCreate: (teamId: string, taskId: string, params: RequestParams = {}) =>
      this.request<BasePinOKBaseRemoteTaskCancelResponse, BasePinErr>({
        path: `/api/v1/teams/${teamId}/remote-task/tasks/${taskId}/cancel`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsSharedConnectionsDetail
     * @summary List shared connections (team scope)
     * @request GET:/api/v1/teams/{teamId}/shared-connections
     */
    v1TeamsSharedConnectionsDetail: (
      teamId: string,
      query?: {
        /** Principal pattern */
        principal_pattern?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/api/v1/teams/${teamId}/shared-connections`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsSharedConnectionsCreate
     * @summary Create shared connection (team scope)
     * @request POST:/api/v1/teams/{teamId}/shared-connections
     */
    v1TeamsSharedConnectionsCreate: (teamId: string, request: BaseJSONMap, params: RequestParams = {}) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/api/v1/teams/${teamId}/shared-connections`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsSharedConnectionsStartAuthCreate
     * @summary Start shared connection auth (team scope)
     * @request POST:/api/v1/teams/{teamId}/shared-connections/start-auth
     */
    v1TeamsSharedConnectionsStartAuthCreate: (teamId: string, request: BaseJSONMap, params: RequestParams = {}) =>
      this.request<BasePinOKBaseRemoteTaskStartAuthResponse, BasePinErr>({
        path: `/api/v1/teams/${teamId}/shared-connections/start-auth`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsSharedConnectionsSubmitAuthCreate
     * @summary Submit shared connection auth (team scope)
     * @request POST:/api/v1/teams/{teamId}/shared-connections/submit-auth
     */
    v1TeamsSharedConnectionsSubmitAuthCreate: (teamId: string, request: BaseJSONMap, params: RequestParams = {}) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/api/v1/teams/${teamId}/shared-connections/submit-auth`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsSharedConnectionsDetail2
     * @summary Get shared connection detail (team scope)
     * @request GET:/api/v1/teams/{teamId}/shared-connections/{connectionId}
     * @originalName v1TeamsSharedConnectionsDetail
     * @duplicate
     */
    v1TeamsSharedConnectionsDetail2: (teamId: string, connectionId: string, params: RequestParams = {}) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/api/v1/teams/${teamId}/shared-connections/${connectionId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsSharedConnectionsUpdate
     * @summary Update shared connection (team scope)
     * @request PUT:/api/v1/teams/{teamId}/shared-connections/{connectionId}
     */
    v1TeamsSharedConnectionsUpdate: (
      teamId: string,
      connectionId: string,
      request: BaseJSONMap,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/api/v1/teams/${teamId}/shared-connections/${connectionId}`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsSharedConnectionsDelete
     * @summary Delete shared connection (team scope)
     * @request DELETE:/api/v1/teams/{teamId}/shared-connections/{connectionId}
     */
    v1TeamsSharedConnectionsDelete: (teamId: string, connectionId: string, params: RequestParams = {}) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/api/v1/teams/${teamId}/shared-connections/${connectionId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name V1TeamsSharedConnectionsReauthCreate
     * @summary Reauth shared connection (team scope)
     * @request POST:/api/v1/teams/{teamId}/shared-connections/{connectionId}/reauth
     */
    v1TeamsSharedConnectionsReauthCreate: (
      teamId: string,
      connectionId: string,
      request: BaseJSONMap,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseRemoteTaskStartAuthResponse, BasePinErr>({
        path: `/api/v1/teams/${teamId}/shared-connections/${connectionId}/reauth`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsSkillsDetail
     * @summary List skills (team user, team-scoped)
     * @request GET:/api/v1/teams/{teamId}/skills
     */
    v1TeamsSkillsDetail: (
      teamId: string,
      query?: {
        /** Search query (name/description/s3Key) */
        query?: string;
        /** Page size */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoListAdminSkillsResponse, BasePinErr>({
        path: `/api/v1/teams/${teamId}/skills`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsSkillsScanCreate
     * @summary Scan team skills from NAS and upsert into DB (team user, team-scoped)
     * @request POST:/api/v1/teams/{teamId}/skills/scan
     */
    v1TeamsSkillsScanCreate: (teamId: string, request: VoAdminScanSkillsRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoAdminScanSkillsResponse, BasePinErr>({
        path: `/api/v1/teams/${teamId}/skills/scan`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsSkillsPartialUpdate
     * @summary Patch skill (team user, team-scoped)
     * @request PATCH:/api/v1/teams/{teamId}/skills/{id}
     */
    v1TeamsSkillsPartialUpdate: (
      teamId: string,
      id: string,
      request: VoPatchSkillRequest,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoAdminSkill, BasePinErr>({
        path: `/api/v1/teams/${teamId}/skills/${id}`,
        method: "PATCH",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsSkillsetsDetail
     * @summary List skillsets (team user, team-scoped)
     * @request GET:/api/v1/teams/{teamId}/skillsets
     */
    v1TeamsSkillsetsDetail: (
      teamId: string,
      query?: {
        /** Search query (name/description) */
        query?: string;
        /** Page size */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoListSkillsetsResponse, BasePinErr>({
        path: `/api/v1/teams/${teamId}/skillsets`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsSkillsetsCreate
     * @summary Create skillset (team user, team-scoped)
     * @request POST:/api/v1/teams/{teamId}/skillsets
     */
    v1TeamsSkillsetsCreate: (teamId: string, request: VoCreateSkillsetRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoSkillset, BasePinErr>({
        path: `/api/v1/teams/${teamId}/skillsets`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsSkillsetsDelete
     * @summary Delete skillset (team user, team-scoped)
     * @request DELETE:/api/v1/teams/{teamId}/skillsets/{id}
     */
    v1TeamsSkillsetsDelete: (teamId: string, id: string, params: RequestParams = {}) =>
      this.request<BasePinOKVoSimpleOKResponse, BasePinErr>({
        path: `/api/v1/teams/${teamId}/skillsets/${id}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Teams
     * @name V1TeamsSkillsetsPartialUpdate
     * @summary Patch skillset (team user, team-scoped)
     * @request PATCH:/api/v1/teams/{teamId}/skillsets/{id}
     */
    v1TeamsSkillsetsPartialUpdate: (
      teamId: string,
      id: string,
      request: VoPatchSkillsetRequest,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoSkillset, BasePinErr>({
        path: `/api/v1/teams/${teamId}/skillsets/${id}`,
        method: "PATCH",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Stations
     * @name V1TeamsStationsDetail
     * @summary Get station
     * @request GET:/api/v1/teams/{teamId}/stations/{stationId}
     */
    v1TeamsStationsDetail: (teamId: string, stationId: string, params: RequestParams = {}) =>
      this.request<VoStation, any>({
        path: `/api/v1/teams/${teamId}/stations/${stationId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Stations
     * @name V1TeamsStationsPartialUpdate
     * @summary Patch station
     * @request PATCH:/api/v1/teams/{teamId}/stations/{stationId}
     */
    v1TeamsStationsPartialUpdate: (
      teamId: string,
      stationId: string,
      request: VoUpdateStationRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoStation, any>({
        path: `/api/v1/teams/${teamId}/stations/${stationId}`,
        method: "PATCH",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Stations
     * @name V1TeamsStationsApiKeysDetail
     * @summary List station api keys
     * @request GET:/api/v1/teams/{teamId}/stations/{stationId}/api-keys
     */
    v1TeamsStationsApiKeysDetail: (teamId: string, stationId: string, params: RequestParams = {}) =>
      this.request<VoListStationApiKeysResponse, any>({
        path: `/api/v1/teams/${teamId}/stations/${stationId}/api-keys`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Stations
     * @name V1TeamsStationsApiKeysRotateCreate
     * @summary Rotate station api key (plaintext returned once)
     * @request POST:/api/v1/teams/{teamId}/stations/{stationId}/api-keys:rotate
     */
    v1TeamsStationsApiKeysRotateCreate: (
      teamId: string,
      stationId: string,
      rotate: string,
      params: RequestParams = {},
    ) =>
      this.request<VoRotateStationApiKeyResponse, any>({
        path: `/api/v1/teams/${teamId}/stations/${stationId}/api-keys${rotate}`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Stations
     * @name V1TeamsStationsChannelConfigUpdate
     * @summary Update station channel config
     * @request PUT:/api/v1/teams/{teamId}/stations/{stationId}/channel-config
     */
    v1TeamsStationsChannelConfigUpdate: (
      teamId: string,
      stationId: string,
      request: VoUpdateStationChannelConfigRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoStation, any>({
        path: `/api/v1/teams/${teamId}/stations/${stationId}/channel-config`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Stations
     * @name V1TeamsStationsDeleteCreate
     * @summary Delete station (soft)
     * @request POST:/api/v1/teams/{teamId}/stations/{stationId}/delete
     */
    v1TeamsStationsDeleteCreate: (teamId: string, stationId: string, params: RequestParams = {}) =>
      this.request<VoStation, any>({
        path: `/api/v1/teams/${teamId}/stations/${stationId}/delete`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Stations
     * @name V1TeamsStationsDisableCreate
     * @summary Disable station
     * @request POST:/api/v1/teams/{teamId}/stations/{stationId}/disable
     */
    v1TeamsStationsDisableCreate: (teamId: string, stationId: string, params: RequestParams = {}) =>
      this.request<VoStation, any>({
        path: `/api/v1/teams/${teamId}/stations/${stationId}/disable`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Stations
     * @name V1TeamsStationsFileAccessUpdate
     * @summary Update station file access
     * @request PUT:/api/v1/teams/{teamId}/stations/{stationId}/file-access
     */
    v1TeamsStationsFileAccessUpdate: (
      teamId: string,
      stationId: string,
      request: VoUpdateStationFileAccessRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoStation, any>({
        path: `/api/v1/teams/${teamId}/stations/${stationId}/file-access`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Stations
     * @name V1TeamsStationsFileGrantTemplateDetail
     * @summary Get station file grant template
     * @request GET:/api/v1/teams/{teamId}/stations/{stationId}/file-grant-template
     */
    v1TeamsStationsFileGrantTemplateDetail: (teamId: string, stationId: string, params: RequestParams = {}) =>
      this.request<VoStation, any>({
        path: `/api/v1/teams/${teamId}/stations/${stationId}/file-grant-template`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Stations
     * @name V1TeamsStationsFileGrantTemplateUpdate
     * @summary Update station file grant template
     * @request PUT:/api/v1/teams/{teamId}/stations/{stationId}/file-grant-template
     */
    v1TeamsStationsFileGrantTemplateUpdate: (
      teamId: string,
      stationId: string,
      request: VoUpdateStationFileGrantTemplateRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoStation, any>({
        path: `/api/v1/teams/${teamId}/stations/${stationId}/file-grant-template`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  e2E = {
    /**
     * No description
     *
     * @tags E2EProof
     * @name V1McplinxProofList
     * @summary Get visible mcplinx proof state (e2e only)
     * @request GET:/e2e/v1/mcplinx-proof
     */
    v1McplinxProofList: (
      query: {
        /** proof id */
        proofId: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<ServicesMcplinxVisibleProofRecord, any>({
        path: `/e2e/v1/mcplinx-proof`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags E2EProof
     * @name V1McplinxProofSendCreate
     * @summary Send visible mcplinx proof flow (e2e only)
     * @request POST:/e2e/v1/mcplinx-proof/send
     */
    v1McplinxProofSendCreate: (request: E2EProofSendRequest, params: RequestParams = {}) =>
      this.request<ServicesMcplinxVisibleProofRecord, any>({
        path: `/e2e/v1/mcplinx-proof/send`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  tenantAdmin = {
    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1AdminAssistantEnsureCreate
     * @summary Ensure admin assistant digiemployee (tenant admin, tenant-scoped)
     * @request POST:/tenant-admin/v1/admin-assistant/ensure
     */
    v1AdminAssistantEnsureCreate: (request: VoTenantAdminAssistantEnsureRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoTenantAdminAssistantEnsureResponse, BasePinErr>({
        path: `/tenant-admin/v1/admin-assistant/ensure`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1AuditLogsList
     * @summary List tenant-admin audit logs (tenant-scoped)
     * @request GET:/tenant-admin/v1/audit-logs
     */
    v1AuditLogsList: (
      query?: {
        /** Filter by resource type */
        resourceType?: string;
        /** Filter by resource id */
        resourceId?: string;
        /** Page size */
        limit?: number;
        /** Pagination cursor */
        cursor?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoListAdminAuditLogsResponse, BasePinErr>({
        path: `/tenant-admin/v1/audit-logs`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1BootstrapTeamCreateAssistantList
     * @summary Get team-create bootstrap assistant (tenant admin, tenant-scoped)
     * @request GET:/tenant-admin/v1/bootstrap/team-create/assistant
     */
    v1BootstrapTeamCreateAssistantList: (params: RequestParams = {}) =>
      this.request<BasePinOKVoConversationAssistant, BasePinErr>({
        path: `/tenant-admin/v1/bootstrap/team-create/assistant`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1ConnectionAuthTasksCreate
     * @summary Create connection auth task (tenant scope)
     * @request POST:/tenant-admin/v1/connection-auth-tasks
     */
    v1ConnectionAuthTasksCreate: (request: VoConnectionAuthTaskCreateRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoConnectionAuthTaskCreateResponse, BasePinErr>({
        path: `/tenant-admin/v1/connection-auth-tasks`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1ConnectorsConfigConnectorsList
     * @summary List connector configs (tenant scope)
     * @request GET:/tenant-admin/v1/connectors/config/connectors
     */
    v1ConnectorsConfigConnectorsList: (params: RequestParams = {}) =>
      this.request<BaseConnectorConfigListResponse, any>({
        path: `/tenant-admin/v1/connectors/config/connectors`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1ConnectorsConfigConnectorsDetail
     * @summary Get connector config detail (tenant scope)
     * @request GET:/tenant-admin/v1/connectors/config/connectors/{connectorId}
     */
    v1ConnectorsConfigConnectorsDetail: (connectorId: string, params: RequestParams = {}) =>
      this.request<BaseConnectorConfigRecord, any>({
        path: `/tenant-admin/v1/connectors/config/connectors/${connectorId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1ConnectorsConfigConnectorsUpdate
     * @summary Update connector config (tenant scope)
     * @request PUT:/tenant-admin/v1/connectors/config/connectors/{connectorId}
     */
    v1ConnectorsConfigConnectorsUpdate: (
      connectorId: string,
      request: BaseConnectorConfigUpdateRequest,
      params: RequestParams = {},
    ) =>
      this.request<BaseConnectorConfigRecord, any>({
        path: `/tenant-admin/v1/connectors/config/connectors/${connectorId}`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1ConnectorsPublishConnectorsList
     * @summary List connectors by tenant scope
     * @request GET:/tenant-admin/v1/connectors/publish/connectors
     */
    v1ConnectorsPublishConnectorsList: (params: RequestParams = {}) =>
      this.request<ArrayBaseConnectorRegistryPackage, any>({
        path: `/tenant-admin/v1/connectors/publish/connectors`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1ConnectorsPublishDeployCreate
     * @summary Deploy connector version (tenant scope)
     * @request POST:/tenant-admin/v1/connectors/publish/deploy
     */
    v1ConnectorsPublishDeployCreate: (request: BaseConnectorRegistryDeployRequest, params: RequestParams = {}) =>
      this.request<BaseConnectorRegistryDeployResponse, any>({
        path: `/tenant-admin/v1/connectors/publish/deploy`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1ConnectorsPublishPublishCreate
     * @summary Publish connector version (tenant scope)
     * @request POST:/tenant-admin/v1/connectors/publish/publish
     */
    v1ConnectorsPublishPublishCreate: (request: BaseConnectorRegistryPublishRequest, params: RequestParams = {}) =>
      this.request<BaseJSONMap, any>({
        path: `/tenant-admin/v1/connectors/publish/publish`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1ConnectorsPublishUploadUrlCreate
     * @summary Create connector upload url (tenant scope)
     * @request POST:/tenant-admin/v1/connectors/publish/upload-url
     */
    v1ConnectorsPublishUploadUrlCreate: (request: BaseConnectorRegistryUploadURLRequest, params: RequestParams = {}) =>
      this.request<BaseConnectorRegistryUploadURLResponse, any>({
        path: `/tenant-admin/v1/connectors/publish/upload-url`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1ConnectorsPublishVersionsList
     * @summary List connector versions by tenant scope
     * @request GET:/tenant-admin/v1/connectors/publish/versions
     */
    v1ConnectorsPublishVersionsList: (
      query: {
        /** Connector ID */
        connector_id: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<ArrayBaseConnectorRegistryVersion, any>({
        path: `/tenant-admin/v1/connectors/publish/versions`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1DigiemployeesList
     * @summary List digiemployees (tenant admin, scoped)
     * @request GET:/tenant-admin/v1/digiemployees
     */
    v1DigiemployeesList: (
      query?: {
        /** Team ID (must belong to current tenant) */
        teamId?: string;
        /** DigiWorker ID */
        digiWorkerId?: string;
        /** Status */
        status?: string;
        /** Page size */
        limit?: number;
        /** Pagination cursor */
        cursor?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoListAdminDigiEmployeesResponse, BasePinErr>({
        path: `/tenant-admin/v1/digiemployees`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1DigiemployeesDetail
     * @summary Get digiemployee detail (tenant admin, scoped)
     * @request GET:/tenant-admin/v1/digiemployees/{id}
     */
    v1DigiemployeesDetail: (id: string, params: RequestParams = {}) =>
      this.request<BasePinOKVoTenantAdminDigiEmployeeDetail, BasePinErr>({
        path: `/tenant-admin/v1/digiemployees/${id}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1DigiemployeesDisableCreate
     * @summary Disable digiemployee (tenant admin, scoped)
     * @request POST:/tenant-admin/v1/digiemployees/{id}/disable
     */
    v1DigiemployeesDisableCreate: (id: string, request: VoAdminDigiEmployeeActionRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoAdminDigiEmployee, BasePinErr>({
        path: `/tenant-admin/v1/digiemployees/${id}/disable`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1DigiemployeesFireCreate
     * @summary Fire digiemployee (tenant admin, scoped)
     * @request POST:/tenant-admin/v1/digiemployees/{id}/fire
     */
    v1DigiemployeesFireCreate: (id: string, request: VoAdminDigiEmployeeActionRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoAdminDigiEmployee, BasePinErr>({
        path: `/tenant-admin/v1/digiemployees/${id}/fire`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1DigiemployeesForceFireCreate
     * @summary Force fire digiemployee (tenant admin, scoped)
     * @request POST:/tenant-admin/v1/digiemployees/{id}/force-fire
     */
    v1DigiemployeesForceFireCreate: (
      id: string,
      request: VoAdminDigiEmployeeActionRequest,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoAdminDigiEmployee, BasePinErr>({
        path: `/tenant-admin/v1/digiemployees/${id}/force-fire`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1DigiworkerDebugConfigList
     * @summary Get digiworker debug config (tenant admin, tenant-scoped)
     * @request GET:/tenant-admin/v1/digiworker/debug-config
     */
    v1DigiworkerDebugConfigList: (params: RequestParams = {}) =>
      this.request<BasePinOKVoTenantAdminDigiworkerDebugConfig, BasePinErr>({
        path: `/tenant-admin/v1/digiworker/debug-config`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1DigiworkerDebugConfigUpdate
     * @summary Put digiworker debug config (tenant admin, tenant-scoped)
     * @request PUT:/tenant-admin/v1/digiworker/debug-config
     */
    v1DigiworkerDebugConfigUpdate: (request: VoTenantAdminDigiworkerDebugConfig, params: RequestParams = {}) =>
      this.request<BasePinOKVoSimpleOKResponse, BasePinErr>({
        path: `/tenant-admin/v1/digiworker/debug-config`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1DigiworkersList
     * @summary List digiworkers (tenant admin, tenant-scoped)
     * @request GET:/tenant-admin/v1/digiworkers
     */
    v1DigiworkersList: (
      query?: {
        /** Only visible in market */
        onlyVisible?: boolean;
        /** Page size */
        limit?: number;
        /** Pagination cursor */
        cursor?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoListTenantAdminDigiWorkersResponse, BasePinErr>({
        path: `/tenant-admin/v1/digiworkers`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1DigiworkersCreate
     * @summary Create digiworker (tenant admin, tenant-scoped)
     * @request POST:/tenant-admin/v1/digiworkers
     */
    v1DigiworkersCreate: (request: VoTenantAdminCreateDigiWorkerRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoTenantAdminDigiWorker, BasePinErr>({
        path: `/tenant-admin/v1/digiworkers`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1DigiworkersAutoCreateThresholdList
     * @summary Get digiworker auto-create threshold (tenant admin, tenant-scoped)
     * @request GET:/tenant-admin/v1/digiworkers/auto-create-threshold
     */
    v1DigiworkersAutoCreateThresholdList: (params: RequestParams = {}) =>
      this.request<BasePinOKVoTenantAdminDigiWorkerAutoCreateThresholdResponse, BasePinErr>({
        path: `/tenant-admin/v1/digiworkers/auto-create-threshold`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1DigiworkersAutoCreateThresholdUpdate
     * @summary Upsert digiworker auto-create threshold (tenant admin, tenant-scoped)
     * @request PUT:/tenant-admin/v1/digiworkers/auto-create-threshold
     */
    v1DigiworkersAutoCreateThresholdUpdate: (
      request: VoTenantAdminUpsertDigiWorkerAutoCreateThresholdRequest,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoSimpleOKResponse, BasePinErr>({
        path: `/tenant-admin/v1/digiworkers/auto-create-threshold`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1DigiworkersSeedsList
     * @summary List digiworker seeds (tenant admin, tenant-scoped)
     * @request GET:/tenant-admin/v1/digiworkers/seeds
     */
    v1DigiworkersSeedsList: (params: RequestParams = {}) =>
      this.request<BasePinOKVoListAdminDigiWorkerSeedsResponse, BasePinErr>({
        path: `/tenant-admin/v1/digiworkers/seeds`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1DigiworkersSeedsCreate
     * @summary Create digiworker seed (tenant admin, tenant-scoped)
     * @request POST:/tenant-admin/v1/digiworkers/seeds
     */
    v1DigiworkersSeedsCreate: (request: VoCreateAdminDigiWorkerSeedRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoAdminDigiWorkerSeed, BasePinErr>({
        path: `/tenant-admin/v1/digiworkers/seeds`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1DigiworkersSeedsDelete
     * @summary Delete digiworker seed (tenant admin, tenant-scoped)
     * @request DELETE:/tenant-admin/v1/digiworkers/seeds/{seedId}
     */
    v1DigiworkersSeedsDelete: (seedId: number, params: RequestParams = {}) =>
      this.request<BasePinOKVoSimpleOKResponse, BasePinErr>({
        path: `/tenant-admin/v1/digiworkers/seeds/${seedId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1DigiworkersSeedsPartialUpdate
     * @summary Patch digiworker seed (tenant admin, tenant-scoped)
     * @request PATCH:/tenant-admin/v1/digiworkers/seeds/{seedId}
     */
    v1DigiworkersSeedsPartialUpdate: (
      seedId: number,
      request: VoPatchAdminDigiWorkerSeedRequest,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoAdminDigiWorkerSeed, BasePinErr>({
        path: `/tenant-admin/v1/digiworkers/seeds/${seedId}`,
        method: "PATCH",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1DigiworkersSeedsPreviewCreate
     * @summary Preview digiworkers generated from seeds (tenant admin, tenant-scoped)
     * @request POST:/tenant-admin/v1/digiworkers/seeds:preview
     */
    v1DigiworkersSeedsPreviewCreate: (
      preview: string,
      request: VoAdminDigiWorkerSeedPreviewRequest,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoAdminDigiWorkerSeedPreviewResponse, BasePinErr>({
        path: `/tenant-admin/v1/digiworkers/seeds${preview}`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1DigiworkersPartialUpdate
     * @summary Patch digiworker (tenant admin, tenant-scoped)
     * @request PATCH:/tenant-admin/v1/digiworkers/{id}
     */
    v1DigiworkersPartialUpdate: (
      id: string,
      request: VoTenantAdminPatchDigiWorkerRequest,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoTenantAdminDigiWorker, BasePinErr>({
        path: `/tenant-admin/v1/digiworkers/${id}`,
        method: "PATCH",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1DigiworkersForceReleaseCreate
     * @summary Force release digiworker (tenant admin, tenant-scoped)
     * @request POST:/tenant-admin/v1/digiworkers/{id}/force-release
     */
    v1DigiworkersForceReleaseCreate: (id: string, request: VoAdminForceReleaseRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoTenantAdminDigiWorker, BasePinErr>({
        path: `/tenant-admin/v1/digiworkers/${id}/force-release`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1DigiworkersRefreshAvatarCreate
     * @summary Refresh avatar binding by worker ID (tenant admin, tenant-scoped)
     * @request POST:/tenant-admin/v1/digiworkers/{id}/refresh-avatar
     */
    v1DigiworkersRefreshAvatarCreate: (id: string, params: RequestParams = {}) =>
      this.request<BasePinOKVoTenantAdminDigiWorker, BasePinErr>({
        path: `/tenant-admin/v1/digiworkers/${id}/refresh-avatar`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1HireEnabledUpdate
     * @summary Upsert hire.enabled (tenant admin, tenant-scoped, public site-config)
     * @request PUT:/tenant-admin/v1/hire/enabled
     */
    v1HireEnabledUpdate: (request: VoTenantAdminUpsertHireEnabledRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoSimpleOKResponse, BasePinErr>({
        path: `/tenant-admin/v1/hire/enabled`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1JobTagsList
     * @summary List job tags (tenant admin, tenant-scoped)
     * @request GET:/tenant-admin/v1/job-tags
     */
    v1JobTagsList: (params: RequestParams = {}) =>
      this.request<BasePinOKVoListTenantAdminJobTagsResponse, BasePinErr>({
        path: `/tenant-admin/v1/job-tags`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1JobTagsCreate
     * @summary Create job tag (tenant admin, tenant-scoped)
     * @request POST:/tenant-admin/v1/job-tags
     */
    v1JobTagsCreate: (request: VoTenantAdminCreateJobTagRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoJobTagItem, BasePinErr>({
        path: `/tenant-admin/v1/job-tags`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1JobTagsDelete
     * @summary Delete job tag (tenant admin, tenant-scoped)
     * @request DELETE:/tenant-admin/v1/job-tags/{id}
     */
    v1JobTagsDelete: (id: string, params: RequestParams = {}) =>
      this.request<BasePinOKVoSimpleOKResponse, BasePinErr>({
        path: `/tenant-admin/v1/job-tags/${id}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1JobTagsPartialUpdate
     * @summary Patch job tag (tenant admin, tenant-scoped)
     * @request PATCH:/tenant-admin/v1/job-tags/{id}
     */
    v1JobTagsPartialUpdate: (id: string, request: VoTenantAdminPatchJobTagRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoJobTagItem, BasePinErr>({
        path: `/tenant-admin/v1/job-tags/${id}`,
        method: "PATCH",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1LinktoolLoginCodesCreate
     * @summary Issue linktool login code for tenant scope
     * @request POST:/tenant-admin/v1/linktool-login/codes
     */
    v1LinktoolLoginCodesCreate: (params: RequestParams = {}) =>
      this.request<VoLinktoolLoginCodeIssueResponse, any>({
        path: `/tenant-admin/v1/linktool-login/codes`,
        method: "POST",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1LlmModelsList
     * @summary List llm models (tenant admin, minimal fields)
     * @request GET:/tenant-admin/v1/llm-models
     */
    v1LlmModelsList: (
      query?: {
        /** Page size */
        limit?: number;
        /** Pagination cursor */
        cursor?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListTenantAdminLLMModelsResponse, any>({
        path: `/tenant-admin/v1/llm-models`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1PortalBrandList
     * @summary Get portal brand (tenant admin, tenant-scoped)
     * @request GET:/tenant-admin/v1/portal-brand
     */
    v1PortalBrandList: (params: RequestParams = {}) =>
      this.request<BasePinOKVoPortalBrand, BasePinErr>({
        path: `/tenant-admin/v1/portal-brand`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1PortalBrandUpdate
     * @summary Upsert portal brand (tenant admin, tenant-scoped)
     * @request PUT:/tenant-admin/v1/portal-brand
     */
    v1PortalBrandUpdate: (request: VoPortalBrand, params: RequestParams = {}) =>
      this.request<BasePinOKVoSimpleOKResponse, BasePinErr>({
        path: `/tenant-admin/v1/portal-brand`,
        method: "PUT",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1PortalBrandAssetsCreate
     * @summary Upload portal brand asset (tenant admin, tenant-scoped)
     * @request POST:/tenant-admin/v1/portal-brand-assets
     */
    v1PortalBrandAssetsCreate: (data: any, params: RequestParams = {}) =>
      this.request<BasePinOKVoPortalBrandAssetUploadResponse, BasePinErr>({
        path: `/tenant-admin/v1/portal-brand-assets`,
        method: "POST",
        body: data,
        type: ContentType.FormData,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1RemoteTaskInstancesList
     * @summary List remote-task connector instances (tenant scope)
     * @request GET:/tenant-admin/v1/remote-task/instances
     */
    v1RemoteTaskInstancesList: (
      query?: {
        /** Instance status */
        status?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKArrayBaseRemoteTaskConnectorInstance, BasePinErr>({
        path: `/tenant-admin/v1/remote-task/instances`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1RemoteTaskInstancesCreate
     * @summary Create remote-task connector instance (tenant scope)
     * @request POST:/tenant-admin/v1/remote-task/instances
     */
    v1RemoteTaskInstancesCreate: (request: BaseRemoteTaskCreateInstanceRequest, params: RequestParams = {}) =>
      this.request<BasePinOKBaseRemoteTaskConnectorInstance, BasePinErr>({
        path: `/tenant-admin/v1/remote-task/instances`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1RemoteTaskInstancesDetail
     * @summary Get remote-task connector instance detail (tenant scope)
     * @request GET:/tenant-admin/v1/remote-task/instances/{instanceId}
     */
    v1RemoteTaskInstancesDetail: (instanceId: string, params: RequestParams = {}) =>
      this.request<BasePinOKBaseRemoteTaskConnectorInstance, BasePinErr>({
        path: `/tenant-admin/v1/remote-task/instances/${instanceId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1RemoteTaskInstancesUpdate
     * @summary Update remote-task connector instance (tenant scope)
     * @request PUT:/tenant-admin/v1/remote-task/instances/{instanceId}
     */
    v1RemoteTaskInstancesUpdate: (
      instanceId: string,
      request: BaseRemoteTaskCreateInstanceRequest,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseRemoteTaskConnectorInstance, BasePinErr>({
        path: `/tenant-admin/v1/remote-task/instances/${instanceId}`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1RemoteTaskInstancesReviewUpdate
     * @summary Review remote-task connector instance (tenant scope)
     * @request PUT:/tenant-admin/v1/remote-task/instances/{instanceId}/review
     */
    v1RemoteTaskInstancesReviewUpdate: (
      instanceId: string,
      request: BaseRemoteTaskReviewInstanceRequest,
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/tenant-admin/v1/remote-task/instances/${instanceId}/review`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1RemoteTaskPackagesList
     * @summary List remote-task connector packages (tenant scope)
     * @request GET:/tenant-admin/v1/remote-task/packages
     */
    v1RemoteTaskPackagesList: (
      query?: {
        /** Package status */
        status?: string;
        /** Package visibility */
        visibility?: string;
        /** Author ID */
        author_id?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseRemoteTaskConnectorPackageListResponse, BasePinErr>({
        path: `/tenant-admin/v1/remote-task/packages`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1RemoteTaskPackagesDetail
     * @summary Get remote-task connector package detail (tenant scope)
     * @request GET:/tenant-admin/v1/remote-task/packages/{pkgId}
     */
    v1RemoteTaskPackagesDetail: (pkgId: string, params: RequestParams = {}) =>
      this.request<BasePinOKBaseRemoteTaskConnectorPackageDetail, BasePinErr>({
        path: `/tenant-admin/v1/remote-task/packages/${pkgId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1RemoteTaskPackagesInstancesDetail
     * @summary List remote-task connector package instances (tenant scope)
     * @request GET:/tenant-admin/v1/remote-task/packages/{pkgId}/instances
     */
    v1RemoteTaskPackagesInstancesDetail: (pkgId: string, params: RequestParams = {}) =>
      this.request<BasePinOKArrayBaseRemoteTaskConnectorInstance, BasePinErr>({
        path: `/tenant-admin/v1/remote-task/packages/${pkgId}/instances`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1RemoteTaskPackagesVersionsDetail
     * @summary List remote-task connector package versions (tenant scope)
     * @request GET:/tenant-admin/v1/remote-task/packages/{pkgId}/versions
     */
    v1RemoteTaskPackagesVersionsDetail: (pkgId: string, params: RequestParams = {}) =>
      this.request<BasePinOKArrayBaseRemoteTaskPackageVersion, BasePinErr>({
        path: `/tenant-admin/v1/remote-task/packages/${pkgId}/versions`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SettlementConfigList
     * @summary Get settlement config (tenant admin, tenant-scoped)
     * @request GET:/tenant-admin/v1/settlement/config
     */
    v1SettlementConfigList: (params: RequestParams = {}) =>
      this.request<BasePinOKVoTenantAdminSettlementConfig, BasePinErr>({
        path: `/tenant-admin/v1/settlement/config`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SettlementConfigUpdate
     * @summary Put settlement config (tenant admin, tenant-scoped)
     * @request PUT:/tenant-admin/v1/settlement/config
     */
    v1SettlementConfigUpdate: (request: VoTenantAdminSettlementConfig, params: RequestParams = {}) =>
      this.request<BasePinOKVoSimpleOKResponse, BasePinErr>({
        path: `/tenant-admin/v1/settlement/config`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SharedConnectionsList
     * @summary List shared connections (tenant scope)
     * @request GET:/tenant-admin/v1/shared-connections
     */
    v1SharedConnectionsList: (
      query?: {
        /** Principal pattern */
        principal_pattern?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/tenant-admin/v1/shared-connections`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SharedConnectionsCreate
     * @summary Create shared connection (tenant scope)
     * @request POST:/tenant-admin/v1/shared-connections
     */
    v1SharedConnectionsCreate: (request: BaseJSONMap, params: RequestParams = {}) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/tenant-admin/v1/shared-connections`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SharedConnectionsFallbackExplainList
     * @summary Explain shared connection fallback (tenant scope)
     * @request GET:/tenant-admin/v1/shared-connections/fallback-explain
     */
    v1SharedConnectionsFallbackExplainList: (
      query: {
        /** Connector ID */
        connector_id: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/tenant-admin/v1/shared-connections/fallback-explain`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SharedConnectionsStartAuthCreate
     * @summary Start shared connection auth (tenant scope)
     * @request POST:/tenant-admin/v1/shared-connections/start-auth
     */
    v1SharedConnectionsStartAuthCreate: (request: BaseJSONMap, params: RequestParams = {}) =>
      this.request<BasePinOKBaseRemoteTaskStartAuthResponse, BasePinErr>({
        path: `/tenant-admin/v1/shared-connections/start-auth`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SharedConnectionsSubmitAuthCreate
     * @summary Submit shared connection auth (tenant scope)
     * @request POST:/tenant-admin/v1/shared-connections/submit-auth
     */
    v1SharedConnectionsSubmitAuthCreate: (request: BaseJSONMap, params: RequestParams = {}) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/tenant-admin/v1/shared-connections/submit-auth`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SharedConnectionsDetail
     * @summary Get shared connection detail (tenant scope)
     * @request GET:/tenant-admin/v1/shared-connections/{connectionId}
     */
    v1SharedConnectionsDetail: (connectionId: string, params: RequestParams = {}) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/tenant-admin/v1/shared-connections/${connectionId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SharedConnectionsUpdate
     * @summary Update shared connection (tenant scope)
     * @request PUT:/tenant-admin/v1/shared-connections/{connectionId}
     */
    v1SharedConnectionsUpdate: (connectionId: string, request: BaseJSONMap, params: RequestParams = {}) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/tenant-admin/v1/shared-connections/${connectionId}`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SharedConnectionsDelete
     * @summary Delete shared connection (tenant scope)
     * @request DELETE:/tenant-admin/v1/shared-connections/{connectionId}
     */
    v1SharedConnectionsDelete: (connectionId: string, params: RequestParams = {}) =>
      this.request<BasePinOKBaseJSONMap, BasePinErr>({
        path: `/tenant-admin/v1/shared-connections/${connectionId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SharedConnectionsReauthCreate
     * @summary Reauth shared connection (tenant scope)
     * @request POST:/tenant-admin/v1/shared-connections/{connectionId}/reauth
     */
    v1SharedConnectionsReauthCreate: (connectionId: string, request: BaseJSONMap, params: RequestParams = {}) =>
      this.request<BasePinOKBaseRemoteTaskStartAuthResponse, BasePinErr>({
        path: `/tenant-admin/v1/shared-connections/${connectionId}/reauth`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SkillsList
     * @summary List skills (tenant admin, tenant-scoped)
     * @request GET:/tenant-admin/v1/skills
     */
    v1SkillsList: (
      query?: {
        /** Search query (name/description/s3Key) */
        query?: string;
        /** Assignment filter (all|unassigned) */
        assigned?: string;
        /** Page size */
        limit?: number;
        /** Pagination cursor (reserved) */
        cursor?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoListAdminSkillsResponse, BasePinErr>({
        path: `/tenant-admin/v1/skills`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SkillsScanCreate
     * @summary Scan skills from private storage and upsert into DB (tenant admin, tenant-scoped)
     * @request POST:/tenant-admin/v1/skills/scan
     */
    v1SkillsScanCreate: (request: VoAdminScanSkillsRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoAdminScanSkillsResponse, BasePinErr>({
        path: `/tenant-admin/v1/skills/scan`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SkillsStorageDeleteCreate
     * @summary Batch delete objects/folders within skills storage (tenant admin, tenant-scoped)
     * @request POST:/tenant-admin/v1/skills/storage/delete
     */
    v1SkillsStorageDeleteCreate: (request: VoAdminDeleteStorageRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoSimpleOKResponse, BasePinErr>({
        path: `/tenant-admin/v1/skills/storage/delete`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SkillsStorageEntriesList
     * @summary Browse skills storage entries (tenant admin, tenant-scoped)
     * @request GET:/tenant-admin/v1/skills/storage/entries
     */
    v1SkillsStorageEntriesList: (
      query?: {
        /** directory prefix (relative to tenant skills root, must end with /) */
        prefix?: string;
        /** pagination cursor (startAfterKey, relative key) */
        cursor?: string;
        /** page size (<= 200) */
        limit?: number;
        /** search in current directory (direct children only) */
        q?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoListAdminStorageEntriesResponse, BasePinErr>({
        path: `/tenant-admin/v1/skills/storage/entries`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SkillsStorageMoveCreate
     * @summary Move objects/folders within skills storage (tenant admin, tenant-scoped)
     * @request POST:/tenant-admin/v1/skills/storage/move
     */
    v1SkillsStorageMoveCreate: (request: VoAdminMoveStorageRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoSimpleOKResponse, BasePinErr>({
        path: `/tenant-admin/v1/skills/storage/move`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SkillsStoragePresignGetCreate
     * @summary Presign GET for skills storage object (tenant admin, tenant-scoped)
     * @request POST:/tenant-admin/v1/skills/storage/presign-get
     */
    v1SkillsStoragePresignGetCreate: (request: VoAdminPresignPrivateStorageRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoAdminPresignPrivateStorageResponse, BasePinErr>({
        path: `/tenant-admin/v1/skills/storage/presign-get`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SkillsStoragePresignPutCreate
     * @summary Presign PUT for skills storage object (tenant admin, tenant-scoped)
     * @request POST:/tenant-admin/v1/skills/storage/presign-put
     */
    v1SkillsStoragePresignPutCreate: (request: VoAdminPresignPrivateStorageRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoAdminPresignPrivateStorageResponse, BasePinErr>({
        path: `/tenant-admin/v1/skills/storage/presign-put`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SkillsPartialUpdate
     * @summary Patch skill (tenant admin, tenant-scoped)
     * @request PATCH:/tenant-admin/v1/skills/{id}
     */
    v1SkillsPartialUpdate: (id: string, request: VoPatchSkillRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoAdminSkill, BasePinErr>({
        path: `/tenant-admin/v1/skills/${id}`,
        method: "PATCH",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SkillsetsList
     * @summary List skillsets (tenant admin, tenant-scoped)
     * @request GET:/tenant-admin/v1/skillsets
     */
    v1SkillsetsList: (
      query?: {
        /** Search query (name/description) */
        query?: string;
        /** Page size */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoListSkillsetsResponse, BasePinErr>({
        path: `/tenant-admin/v1/skillsets`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SkillsetsCreate
     * @summary Create skillset (tenant admin, tenant-scoped)
     * @request POST:/tenant-admin/v1/skillsets
     */
    v1SkillsetsCreate: (request: VoCreateSkillsetRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoSkillset, BasePinErr>({
        path: `/tenant-admin/v1/skillsets`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SkillsetsDelete
     * @summary Delete skillset (tenant admin, tenant-scoped)
     * @request DELETE:/tenant-admin/v1/skillsets/{id}
     */
    v1SkillsetsDelete: (id: string, params: RequestParams = {}) =>
      this.request<BasePinOKVoSimpleOKResponse, BasePinErr>({
        path: `/tenant-admin/v1/skillsets/${id}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1SkillsetsPartialUpdate
     * @summary Patch skillset (tenant admin, tenant-scoped)
     * @request PATCH:/tenant-admin/v1/skillsets/{id}
     */
    v1SkillsetsPartialUpdate: (id: string, request: VoPatchSkillsetRequest, params: RequestParams = {}) =>
      this.request<BasePinOKVoSkillset, BasePinErr>({
        path: `/tenant-admin/v1/skillsets/${id}`,
        method: "PATCH",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1TeamFilesDeleteCreate
     * @summary Delete team root files (tenant admin)
     * @request POST:/tenant-admin/v1/team-files/delete
     */
    v1TeamFilesDeleteCreate: (request: VoAdminTeamFileDeleteRequest, params: RequestParams = {}) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/tenant-admin/v1/team-files/delete`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1TeamFilesEntriesList
     * @summary Browse team root file entries (tenant admin)
     * @request GET:/tenant-admin/v1/team-files/entries
     */
    v1TeamFilesEntriesList: (
      query: {
        /** team id */
        teamId: string;
        /** root kind */
        rootKind: string;
        /** case ident */
        caseIdent?: string;
        /** external user id */
        externalUserId?: string;
        /** directory prefix */
        prefix?: string;
        /** pagination cursor */
        cursor?: string;
        /** page size (<=200) */
        limit?: number;
        /** search direct children by name */
        q?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListTeamStorageEntriesResponse, any>({
        path: `/tenant-admin/v1/team-files/entries`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1TeamFilesMoveCreate
     * @summary Move team root files (tenant admin)
     * @request POST:/tenant-admin/v1/team-files/move
     */
    v1TeamFilesMoveCreate: (request: VoAdminTeamFileMoveRequest, params: RequestParams = {}) =>
      this.request<VoSimpleOKResponse, any>({
        path: `/tenant-admin/v1/team-files/move`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1TeamFilesPresignGetCreate
     * @summary Presign GET for team root file (tenant admin)
     * @request POST:/tenant-admin/v1/team-files/presign-get
     */
    v1TeamFilesPresignGetCreate: (request: VoAdminTeamFilePresignRequest, params: RequestParams = {}) =>
      this.request<VoTeamPresignResponse, any>({
        path: `/tenant-admin/v1/team-files/presign-get`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1TeamFilesPresignPutCreate
     * @summary Presign PUT for team root file (tenant admin)
     * @request POST:/tenant-admin/v1/team-files/presign-put
     */
    v1TeamFilesPresignPutCreate: (request: VoAdminTeamFilePresignRequest, params: RequestParams = {}) =>
      this.request<VoTeamPresignResponse, any>({
        path: `/tenant-admin/v1/team-files/presign-put`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1TeamFilesUploadFinalizeCreate
     * @summary Finalize uploaded team root file (tenant admin)
     * @request POST:/tenant-admin/v1/team-files/upload-finalize
     */
    v1TeamFilesUploadFinalizeCreate: (request: VoAdminTeamFileFinalizeRequest, params: RequestParams = {}) =>
      this.request<VoTeamUploadFinalizeResponse, any>({
        path: `/tenant-admin/v1/team-files/upload-finalize`,
        method: "POST",
        body: request,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1TeamsList
     * @summary List teams in current tenant (tenant admin)
     * @request GET:/tenant-admin/v1/teams
     */
    v1TeamsList: (
      query?: {
        /** Query by team name or registration name */
        q?: string;
        /** Pagination size */
        limit?: number;
        /** Pagination cursor */
        cursor?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BasePinOKVoListTeamsResponse, BasePinErr>({
        path: `/tenant-admin/v1/teams`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1TeamsDetail
     * @summary Get team by id in current tenant (tenant admin)
     * @request GET:/tenant-admin/v1/teams/{teamId}
     */
    v1TeamsDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<BasePinOKVoTeam, BasePinErr>({
        path: `/tenant-admin/v1/teams/${teamId}`,
        method: "GET",
        format: "json",
        ...params,
      }),
  };
}


// --- pin array aliases ---
export type ArrayBaseConnectorRegistryPackage = BaseConnectorRegistryPackage[];
export type ArrayBaseConnectorRegistryVersion = BaseConnectorRegistryVersion[];
export type ArrayBaseRemoteTaskConnectorInstance = BaseRemoteTaskConnectorInstance[];
export type ArrayBaseRemoteTaskPackageVersion = BaseRemoteTaskPackageVersion[];


// --- swagger type aliases ---
export type Case = VoCase;
export type InboxItem = VoInboxItem;
export type FileNode = VoFileNode;
export type Team = VoTeam;
export type HumanUser = VoHumanUser;
export type TeamMembership = VoTeamMembership;
export type DigiEmployee = VoDigiEmployee;
