/*
 * Copyright (c) 2025 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */
import {
  Entity,
  DefaultDeSerializers,
  DeSerializers,
  DeserializedType
} from '@sap-cloud-sdk/odata-v2';
import type { ItemsSetApi } from './ItemsSetApi';
/**
 * This class represents the entity "ItemsSet" of service "ZFMFR_CREATE_ODATA_SRV".
 */
export declare class ItemsSet<T extends DeSerializers = DefaultDeSerializers>
  extends Entity
  implements ItemsSetType<T>
{
  /**
   * Technical entity name for ItemsSet.
   */
  static _entityName: string;
  /**
   * Default url path for the according service.
   */
  static _defaultBasePath: string;
  /**
   * All key fields of the ItemsSet entity.
   */
  static _keys: string[];
  /**
   * Document item.
   * Maximum length: 3.
   */
  blpos: DeserializedType<T, 'Edm.String'>;
  /**
   * Cost Center.
   * Maximum length: 10.
   */
  kostl: DeserializedType<T, 'Edm.String'>;
  /**
   * Amount.
   */
  wrbtr: DeserializedType<T, 'Edm.Decimal'>;
  /**
   * Text.
   * Maximum length: 50.
   */
  ptext: DeserializedType<T, 'Edm.String'>;
  constructor(_entityApi: ItemsSetApi<T>);
}
export interface ItemsSetType<T extends DeSerializers = DefaultDeSerializers> {
  blpos: DeserializedType<T, 'Edm.String'>;
  kostl: DeserializedType<T, 'Edm.String'>;
  wrbtr: DeserializedType<T, 'Edm.Decimal'>;
  ptext: DeserializedType<T, 'Edm.String'>;
}
