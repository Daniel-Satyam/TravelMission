/*
 * Copyright (c) 2025 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */
import {
  CreateRequestBuilder,
  DeleteRequestBuilder,
  DeSerializers,
  GetAllRequestBuilder,
  GetByKeyRequestBuilder,
  ODataBatchRequestBuilder,
  UpdateRequestBuilder,
  BatchChangeSet
} from '@sap-cloud-sdk/odata-v2';
import { transformVariadicArgumentToArray } from '@sap-cloud-sdk/util';
import { HeaderSet, ItemsSet } from './index';

/**
 * Batch builder for operations supported on the Zfmfr Create Odata Srv.
 * @param requests The requests of the batch.
 * @returns A request builder for batch.
 */
export function batch<DeSerializersT extends DeSerializers>(
  ...requests: Array<
    | ReadZfmfrCreateOdataSrvRequestBuilder<DeSerializersT>
    | BatchChangeSet<DeSerializersT>
  >
): ODataBatchRequestBuilder<DeSerializersT>;
export function batch<DeSerializersT extends DeSerializers>(
  requests: Array<
    | ReadZfmfrCreateOdataSrvRequestBuilder<DeSerializersT>
    | BatchChangeSet<DeSerializersT>
  >
): ODataBatchRequestBuilder<DeSerializersT>;
export function batch<DeSerializersT extends DeSerializers>(
  first:
    | undefined
    | ReadZfmfrCreateOdataSrvRequestBuilder<DeSerializersT>
    | BatchChangeSet<DeSerializersT>
    | Array<
        | ReadZfmfrCreateOdataSrvRequestBuilder<DeSerializersT>
        | BatchChangeSet<DeSerializersT>
      >,
  ...rest: Array<
    | ReadZfmfrCreateOdataSrvRequestBuilder<DeSerializersT>
    | BatchChangeSet<DeSerializersT>
  >
): ODataBatchRequestBuilder<DeSerializersT> {
  return new ODataBatchRequestBuilder(
    defaultZfmfrCreateOdataSrvPath,
    transformVariadicArgumentToArray(first, rest)
  );
}

/**
 * Change set constructor consists of write operations supported on the Zfmfr Create Odata Srv.
 * @param requests The requests of the change set.
 * @returns A change set for batch.
 */
export function changeset<DeSerializersT extends DeSerializers>(
  ...requests: Array<WriteZfmfrCreateOdataSrvRequestBuilder<DeSerializersT>>
): BatchChangeSet<DeSerializersT>;
export function changeset<DeSerializersT extends DeSerializers>(
  requests: Array<WriteZfmfrCreateOdataSrvRequestBuilder<DeSerializersT>>
): BatchChangeSet<DeSerializersT>;
export function changeset<DeSerializersT extends DeSerializers>(
  first:
    | undefined
    | WriteZfmfrCreateOdataSrvRequestBuilder<DeSerializersT>
    | Array<WriteZfmfrCreateOdataSrvRequestBuilder<DeSerializersT>>,
  ...rest: Array<WriteZfmfrCreateOdataSrvRequestBuilder<DeSerializersT>>
): BatchChangeSet<DeSerializersT> {
  return new BatchChangeSet(transformVariadicArgumentToArray(first, rest));
}

export const defaultZfmfrCreateOdataSrvPath =
  '/sap/opu/odata/sap/ZFMFR_CREATE_ODATA_SRV';
export type ReadZfmfrCreateOdataSrvRequestBuilder<
  DeSerializersT extends DeSerializers
> =
  | GetAllRequestBuilder<HeaderSet<DeSerializersT>, DeSerializersT>
  | GetAllRequestBuilder<ItemsSet<DeSerializersT>, DeSerializersT>
  | GetByKeyRequestBuilder<HeaderSet<DeSerializersT>, DeSerializersT>
  | GetByKeyRequestBuilder<ItemsSet<DeSerializersT>, DeSerializersT>;
export type WriteZfmfrCreateOdataSrvRequestBuilder<
  DeSerializersT extends DeSerializers
> =
  | CreateRequestBuilder<HeaderSet<DeSerializersT>, DeSerializersT>
  | UpdateRequestBuilder<HeaderSet<DeSerializersT>, DeSerializersT>
  | DeleteRequestBuilder<HeaderSet<DeSerializersT>, DeSerializersT>
  | CreateRequestBuilder<ItemsSet<DeSerializersT>, DeSerializersT>
  | UpdateRequestBuilder<ItemsSet<DeSerializersT>, DeSerializersT>
  | DeleteRequestBuilder<ItemsSet<DeSerializersT>, DeSerializersT>;
