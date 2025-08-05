/*
 * Copyright (c) 2025 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */
import {
  CreateRequestBuilder,
  DeSerializers,
  DefaultDeSerializers,
  DeleteRequestBuilder,
  DeserializedType,
  GetAllRequestBuilder,
  GetByKeyRequestBuilder,
  RequestBuilder,
  UpdateRequestBuilder
} from '@sap-cloud-sdk/odata-v2';
import { HeaderSet } from './HeaderSet';
/**
 * Request builder class for operations supported on the {@link HeaderSet} entity.
 */
export declare class HeaderSetRequestBuilder<
  T extends DeSerializers = DefaultDeSerializers
> extends RequestBuilder<HeaderSet<T>, T> {
  /**
   * Returns a request builder for querying all `HeaderSet` entities.
   * @returns A request builder for creating requests to retrieve all `HeaderSet` entities.
   */
  getAll(): GetAllRequestBuilder<HeaderSet<T>, T>;
  /**
   * Returns a request builder for creating a `HeaderSet` entity.
   * @param entity The entity to be created
   * @returns A request builder for creating requests that create an entity of type `HeaderSet`.
   */
  create(entity: HeaderSet<T>): CreateRequestBuilder<HeaderSet<T>, T>;
  /**
   * Returns a request builder for retrieving one `HeaderSet` entity based on its keys.
   * @param ktext Key property. See {@link HeaderSet.ktext}.
   * @returns A request builder for creating requests to retrieve one `HeaderSet` entity based on its keys.
   */
  getByKey(
    ktext: DeserializedType<T, 'Edm.String'>
  ): GetByKeyRequestBuilder<HeaderSet<T>, T>;
  /**
   * Returns a request builder for updating an entity of type `HeaderSet`.
   * @param entity The entity to be updated
   * @returns A request builder for creating requests that update an entity of type `HeaderSet`.
   */
  update(entity: HeaderSet<T>): UpdateRequestBuilder<HeaderSet<T>, T>;
  /**
   * Returns a request builder for deleting an entity of type `HeaderSet`.
   * @param ktext Key property. See {@link HeaderSet.ktext}.
   * @returns A request builder for creating requests that delete an entity of type `HeaderSet`.
   */
  delete(ktext: string): DeleteRequestBuilder<HeaderSet<T>, T>;
  /**
   * Returns a request builder for deleting an entity of type `HeaderSet`.
   * @param entity Pass the entity to be deleted.
   * @returns A request builder for creating requests that delete an entity of type `HeaderSet` by taking the entity as a parameter.
   */
  delete(entity: HeaderSet<T>): DeleteRequestBuilder<HeaderSet<T>, T>;
}
