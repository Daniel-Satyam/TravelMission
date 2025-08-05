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
import type { HeaderSetApi } from './HeaderSetApi';
import { ItemsSet, ItemsSetType } from './ItemsSet';
/**
 * This class represents the entity "HeaderSet" of service "ZFMFR_CREATE_ODATA_SRV".
 */
export declare class HeaderSet<T extends DeSerializers = DefaultDeSerializers>
  extends Entity
  implements HeaderSetType<T>
{
  /**
   * Technical entity name for HeaderSet.
   */
  static _entityName: string;
  /**
   * Default url path for the according service.
   */
  static _defaultBasePath: string;
  /**
   * All key fields of the HeaderSet entity.
   */
  static _keys: string[];
  /**
   * DOCUMENT STATUS.
   * Maximum length: 1.
   * @nullable
   */
  status?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Trans. Currency.
   * Maximum length: 5.
   * @nullable
   */
  waers?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Document Date.
   * @nullable
   */
  bldat?: DeserializedType<T, 'Edm.DateTime'> | null;
  /**
   * Document Text.
   * Maximum length: 50.
   */
  ktext: DeserializedType<T, 'Edm.String'>;
  /**
   * Message Text.
   * Maximum length: 220.
   * @nullable
   */
  retMsg?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Earmarked Funds.
   * Maximum length: 10.
   * @nullable
   */
  belnr?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * One-to-many navigation property to the {@link ItemsSet} entity.
   */
  headerToItem: ItemsSet<T>[];
  constructor(_entityApi: HeaderSetApi<T>);
}
export interface HeaderSetType<T extends DeSerializers = DefaultDeSerializers> {
  status?: DeserializedType<T, 'Edm.String'> | null;
  waers?: DeserializedType<T, 'Edm.String'> | null;
  bldat?: DeserializedType<T, 'Edm.DateTime'> | null;
  ktext: DeserializedType<T, 'Edm.String'>;
  retMsg?: DeserializedType<T, 'Edm.String'> | null;
  belnr?: DeserializedType<T, 'Edm.String'> | null;
  headerToItem: ItemsSetType<T>[];
}
