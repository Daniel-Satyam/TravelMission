/*
 * Copyright (c) 2025 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */
import { BigNumber } from 'bignumber.js';
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
import { ItemsSet } from './ItemsSet';

/**
 * Request builder class for operations supported on the {@link ItemsSet} entity.
 */
export class ItemsSetRequestBuilder<
  T extends DeSerializers = DefaultDeSerializers
> extends RequestBuilder<ItemsSet<T>, T> {
  /**
   * Returns a request builder for querying all `ItemsSet` entities.
   * @returns A request builder for creating requests to retrieve all `ItemsSet` entities.
   */
  getAll(): GetAllRequestBuilder<ItemsSet<T>, T> {
    return new GetAllRequestBuilder<ItemsSet<T>, T>(this.entityApi);
  }

  /**
   * Returns a request builder for creating a `ItemsSet` entity.
   * @param entity The entity to be created
   * @returns A request builder for creating requests that create an entity of type `ItemsSet`.
   */
  create(entity: ItemsSet<T>): CreateRequestBuilder<ItemsSet<T>, T> {
    return new CreateRequestBuilder<ItemsSet<T>, T>(this.entityApi, entity);
  }

  /**
   * Returns a request builder for retrieving one `ItemsSet` entity based on its keys.
   * @param blpos Key property. See {@link ItemsSet.blpos}.
   * @param kostl Key property. See {@link ItemsSet.kostl}.
   * @param wrbtr Key property. See {@link ItemsSet.wrbtr}.
   * @param ptext Key property. See {@link ItemsSet.ptext}.
   * @returns A request builder for creating requests to retrieve one `ItemsSet` entity based on its keys.
   */
  getByKey(
    blpos: DeserializedType<T, 'Edm.String'>,
    kostl: DeserializedType<T, 'Edm.String'>,
    wrbtr: DeserializedType<T, 'Edm.Decimal'>,
    ptext: DeserializedType<T, 'Edm.String'>
  ): GetByKeyRequestBuilder<ItemsSet<T>, T> {
    return new GetByKeyRequestBuilder<ItemsSet<T>, T>(this.entityApi, {
      BLPOS: blpos,
      KOSTL: kostl,
      WRBTR: wrbtr,
      PTEXT: ptext
    });
  }

  /**
   * Returns a request builder for updating an entity of type `ItemsSet`.
   * @param entity The entity to be updated
   * @returns A request builder for creating requests that update an entity of type `ItemsSet`.
   */
  update(entity: ItemsSet<T>): UpdateRequestBuilder<ItemsSet<T>, T> {
    return new UpdateRequestBuilder<ItemsSet<T>, T>(this.entityApi, entity);
  }

  /**
   * Returns a request builder for deleting an entity of type `ItemsSet`.
   * @param blpos Key property. See {@link ItemsSet.blpos}.
   * @param kostl Key property. See {@link ItemsSet.kostl}.
   * @param wrbtr Key property. See {@link ItemsSet.wrbtr}.
   * @param ptext Key property. See {@link ItemsSet.ptext}.
   * @returns A request builder for creating requests that delete an entity of type `ItemsSet`.
   */
  delete(
    blpos: string,
    kostl: string,
    wrbtr: BigNumber,
    ptext: string
  ): DeleteRequestBuilder<ItemsSet<T>, T>;
  /**
   * Returns a request builder for deleting an entity of type `ItemsSet`.
   * @param entity Pass the entity to be deleted.
   * @returns A request builder for creating requests that delete an entity of type `ItemsSet` by taking the entity as a parameter.
   */
  delete(entity: ItemsSet<T>): DeleteRequestBuilder<ItemsSet<T>, T>;
  delete(
    blposOrEntity: any,
    kostl?: string,
    wrbtr?: BigNumber,
    ptext?: string
  ): DeleteRequestBuilder<ItemsSet<T>, T> {
    return new DeleteRequestBuilder<ItemsSet<T>, T>(
      this.entityApi,
      blposOrEntity instanceof ItemsSet
        ? blposOrEntity
        : {
            BLPOS: blposOrEntity!,
            KOSTL: kostl!,
            WRBTR: wrbtr!,
            PTEXT: ptext!
          }
    );
  }
}
