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

export interface ControllerCompleteAuthDomainLoginSessionResponse {
  loginCode?: string;
}

export interface ControllerCreateAuthDomainLoginSessionRequest {
  authDomain?: string;
  redirectUri?: string;
}

export interface ControllerCreateAuthDomainLoginSessionResponse {
  loginUrl?: string;
  sessionId?: string;
}

export interface ControllerExchangeAuthDomainLoginRequest {
  loginCode?: string;
  sessionId?: string;
}

export interface ControllerExchangeAuthDomainLoginResponse {
  accessToken?: string;
  expiresIn?: number;
  refreshToken?: string;
  tokenType?: string;
  user?: ControllerExchangeAuthDomainLoginUserResponse;
}

export interface ControllerExchangeAuthDomainLoginUserResponse {
  email?: string;
  id?: string;
  name?: string;
  phone?: string;
}

export interface ControllerTenantAdminTeamLedgerEntriesResponse {
  items?: ControllerTenantAdminTeamLedgerEntryItem[];
  nextCursor?: string;
}

export interface ControllerTenantAdminTeamLedgerEntryItem {
  createdAt?: string;
  effectiveAt?: string;
  entryId?: string;
  idempotencyKey?: string;
  periodKey?: string;
  pointsDelta?: number;
  ref?: string;
  teamId?: string;
  type?: string;
}

export interface ControllerTenantAdminTeamPointsTransferRequest {
  points?: number;
}

export interface ControllerTenantAdminTeamPointsTransferResponse {
  applied?: boolean;
}

export interface ControllerTenantAdminTeamWalletResponse {
  balancePoints?: number;
  teamId?: string;
}

export interface ControllerTenantAdminTenantLedgerEntriesResponse {
  items?: ControllerTenantAdminTenantLedgerEntryItem[];
  nextCursor?: string;
}

export interface ControllerTenantAdminTenantLedgerEntryItem {
  createdAt?: string;
  effectiveAt?: string;
  entryId?: string;
  idempotencyKey?: string;
  periodKey?: string;
  pointsDelta?: number;
  ref?: string;
  tenantId?: string;
  type?: string;
}

export interface ControllerTenantAdminTenantWalletResponse {
  balancePoints?: number;
  tenantId?: string;
}

export type VoCompleteTeamOrganizationCertificationDocumentUploadRequest = object;

export interface VoListTeamCertificationReviewsResponse {
  items?: VoTeamCertificationReviewListItem[];
}

export interface VoPrepareTeamOrganizationCertificationDocumentUploadRequest {
  contentType?: string;
  fileName: string;
}

export interface VoPrepareTeamOrganizationCertificationDocumentUploadResponse {
  documentId?: string;
  method?: string;
  storageKey?: string;
  uploadUrl?: string;
}

export interface VoReviewTeamCertificationRequest {
  reviewComment?: string;
}

export interface VoSubmitTeamOrganizationCertificationRequest {
  documentIds: string[];
  organizationType: string;
  registrationName: string;
  unifiedSocialCreditCode: string;
}

export interface VoTeamCertificationReviewListItem {
  certificationStatus?: string;
  registrationName?: string;
  reviewComment?: string;
  teamId?: string;
}

export interface VoTeamOrganizationCertificationDocument {
  documentId?: string;
  fileName?: string;
  status?: string;
}

export interface VoTeamOrganizationProfileResponse {
  certificationDocuments?: VoTeamOrganizationCertificationDocument[];
  certificationStatus?: string;
  contactEmail?: string;
  contactName?: string;
  contactPhone?: string;
  organizationType?: string;
  registrationName?: string;
  reviewComment?: string;
  teamId?: string;
  unifiedSocialCreditCode?: string;
}

export interface VoUpdateTeamOrganizationContactRequest {
  contactEmail?: string;
  contactName?: string;
  contactPhone?: string;
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
 * @title Account API
 * @version 1.0
 * @baseUrl /
 * @contact
 *
 * Account and auth services
 */
export class Api<SecurityDataType extends unknown> extends HttpClient<SecurityDataType> {
  api = {
    /**
     * No description
     *
     * @tags Account
     * @name V1TeamsOrganizationCertificationDocumentsCompleteCreate
     * @summary Complete organization certification document upload
     * @request POST:/api/v1/teams/{teamId}/organization-certification-documents/{documentId}/complete
     */
    v1TeamsOrganizationCertificationDocumentsCompleteCreate: (
      teamId: string,
      documentId: string,
      request: VoCompleteTeamOrganizationCertificationDocumentUploadRequest,
      params: RequestParams = {},
    ) =>
      this.request<Record<string, boolean>, Record<string, any>>({
        path: `/api/v1/teams/${teamId}/organization-certification-documents/${documentId}/complete`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Account
     * @name V1TeamsOrganizationCertificationDocumentsPrepareUploadCreate
     * @summary Prepare organization certification document upload
     * @request POST:/api/v1/teams/{teamId}/organization-certification-documents:prepare-upload
     */
    v1TeamsOrganizationCertificationDocumentsPrepareUploadCreate: (
      teamId: string,
      request: VoPrepareTeamOrganizationCertificationDocumentUploadRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoPrepareTeamOrganizationCertificationDocumentUploadResponse, Record<string, any>>({
        path: `/api/v1/teams/${teamId}/organization-certification-documents:prepare-upload`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Account
     * @name V1TeamsOrganizationCertificationSubmitCreate
     * @summary Submit team organization certification
     * @request POST:/api/v1/teams/{teamId}/organization-certification/submit
     */
    v1TeamsOrganizationCertificationSubmitCreate: (
      teamId: string,
      request: VoSubmitTeamOrganizationCertificationRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoTeamOrganizationProfileResponse, Record<string, any>>({
        path: `/api/v1/teams/${teamId}/organization-certification/submit`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Account
     * @name V1TeamsOrganizationProfileDetail
     * @summary Get team organization profile
     * @request GET:/api/v1/teams/{teamId}/organization-profile
     */
    v1TeamsOrganizationProfileDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<VoTeamOrganizationProfileResponse, Record<string, any>>({
        path: `/api/v1/teams/${teamId}/organization-profile`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Account
     * @name V1TeamsOrganizationProfileContactUpdate
     * @summary Update team organization contact
     * @request PUT:/api/v1/teams/{teamId}/organization-profile/contact
     */
    v1TeamsOrganizationProfileContactUpdate: (
      teamId: string,
      request: VoUpdateTeamOrganizationContactRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoTeamOrganizationProfileResponse, Record<string, any>>({
        path: `/api/v1/teams/${teamId}/organization-profile/contact`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  authDomainLogin = {
    /**
     * No description
     *
     * @tags Account
     * @name ExchangeCreate
     * @summary Exchange auth-domain login code
     * @request POST:/auth-domain-login/exchange
     */
    exchangeCreate: (request: ControllerExchangeAuthDomainLoginRequest, params: RequestParams = {}) =>
      this.request<ControllerExchangeAuthDomainLoginResponse, any>({
        path: `/auth-domain-login/exchange`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Account
     * @name SessionsCreate
     * @summary Create auth-domain login session
     * @request POST:/auth-domain-login/sessions
     */
    sessionsCreate: (request: ControllerCreateAuthDomainLoginSessionRequest, params: RequestParams = {}) =>
      this.request<ControllerCreateAuthDomainLoginSessionResponse, any>({
        path: `/auth-domain-login/sessions`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Account
     * @name SessionsCompleteCreate
     * @summary Complete auth-domain login session
     * @request POST:/auth-domain-login/sessions/{sessionId}/complete
     */
    sessionsCompleteCreate: (sessionId: string, params: RequestParams = {}) =>
      this.request<ControllerCompleteAuthDomainLoginSessionResponse, any>({
        path: `/auth-domain-login/sessions/${sessionId}/complete`,
        method: "POST",
        format: "json",
        ...params,
      }),
  };
  tenantAdmin = {
    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1TeamCertificationsList
     * @summary List team certification reviews (tenant admin)
     * @request GET:/tenant-admin/v1/team-certifications
     */
    v1TeamCertificationsList: (
      query?: {
        /** Certification status filter */
        status?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VoListTeamCertificationReviewsResponse, Record<string, any>>({
        path: `/tenant-admin/v1/team-certifications`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1TeamCertificationsApproveCreate
     * @summary Approve team certification (tenant admin)
     * @request POST:/tenant-admin/v1/team-certifications/{teamId}/approve
     */
    v1TeamCertificationsApproveCreate: (
      teamId: string,
      request: VoReviewTeamCertificationRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoTeamOrganizationProfileResponse, Record<string, any>>({
        path: `/tenant-admin/v1/team-certifications/${teamId}/approve`,
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
     * @name V1TeamCertificationsRejectCreate
     * @summary Reject team certification (tenant admin)
     * @request POST:/tenant-admin/v1/team-certifications/{teamId}/reject
     */
    v1TeamCertificationsRejectCreate: (
      teamId: string,
      request: VoReviewTeamCertificationRequest,
      params: RequestParams = {},
    ) =>
      this.request<VoTeamOrganizationProfileResponse, Record<string, any>>({
        path: `/tenant-admin/v1/team-certifications/${teamId}/reject`,
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
     * @name V1TeamsLedgerEntriesDetail
     * @summary List team ledger entries (range query, tenant admin)
     * @request GET:/tenant-admin/v1/teams/{teamId}/ledger-entries
     */
    v1TeamsLedgerEntriesDetail: (
      teamId: string,
      query: {
        /** RFC3339 start (inclusive) */
        from: string;
        /** RFC3339 end (exclusive) */
        to: string;
        /** Cursor */
        cursor?: string;
        /** Limit */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<ControllerTenantAdminTeamLedgerEntriesResponse, any>({
        path: `/tenant-admin/v1/teams/${teamId}/ledger-entries`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1TeamsPointsTransfersCreate
     * @summary Tenant transfers points to team (tenant admin)
     * @request POST:/tenant-admin/v1/teams/{teamId}/points-transfers
     */
    v1TeamsPointsTransfersCreate: (
      teamId: string,
      request: ControllerTenantAdminTeamPointsTransferRequest,
      params: RequestParams = {},
    ) =>
      this.request<ControllerTenantAdminTeamPointsTransferResponse, any>({
        path: `/tenant-admin/v1/teams/${teamId}/points-transfers`,
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
     * @name V1TeamsWalletDetail
     * @summary Get team wallet balance (tenant admin)
     * @request GET:/tenant-admin/v1/teams/{teamId}/wallet
     */
    v1TeamsWalletDetail: (teamId: string, params: RequestParams = {}) =>
      this.request<ControllerTenantAdminTeamWalletResponse, any>({
        path: `/tenant-admin/v1/teams/${teamId}/wallet`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1TenantLedgerEntriesList
     * @summary List tenant ledger entries (range query, tenant admin)
     * @request GET:/tenant-admin/v1/tenant/ledger-entries
     */
    v1TenantLedgerEntriesList: (
      query: {
        /** RFC3339 start (inclusive) */
        from: string;
        /** RFC3339 end (exclusive) */
        to: string;
        /** Cursor */
        cursor?: string;
        /** Limit */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<ControllerTenantAdminTenantLedgerEntriesResponse, any>({
        path: `/tenant-admin/v1/tenant/ledger-entries`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags TenantAdmin
     * @name V1TenantWalletList
     * @summary Get tenant wallet balance (tenant admin)
     * @request GET:/tenant-admin/v1/tenant/wallet
     */
    v1TenantWalletList: (params: RequestParams = {}) =>
      this.request<ControllerTenantAdminTenantWalletResponse, any>({
        path: `/tenant-admin/v1/tenant/wallet`,
        method: "GET",
        format: "json",
        ...params,
      }),
  };
}
