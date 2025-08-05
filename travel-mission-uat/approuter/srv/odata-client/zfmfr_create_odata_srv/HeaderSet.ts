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
export class HeaderSet<T extends DeSerializers = DefaultDeSerializers>
  extends Entity
  implements HeaderSetType<T>
{
  /**
   * Technical entity name for HeaderSet.
   */
  static override _entityName = 'HeaderSet';
  /**
   * Default url path for the according service.
   */
  static override _defaultBasePath =
    '/sap/opu/odata/sap/ZFMFR_CREATE_ODATA_SRV';
  /**
   * All key fields of the HeaderSet entity.
   */
  static _keys = ['KTEXT'];
  /**
   * DOCUMENT STATUS.
   * Maximum length: 1.
   * @nullable
   */
  declare status?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Trans. Currency.
   * Maximum length: 5.
   * @nullable
   */
  declare waers?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Document Date.
   * @nullable
   */
  declare bldat?: DeserializedType<T, 'Edm.DateTime'> | null;
  /**
   * Document Text.
   * Maximum length: 50.
   */
  declare ktext: DeserializedType<T, 'Edm.String'>;
  /**
   * Message Text.
   * Maximum length: 220.
   * @nullable
   */
  declare retMsg?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Earmarked Funds.
   * Maximum length: 10.
   * @nullable
   */
  declare belnr?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * One-to-many navigation property to the {@link ItemsSet} entity.
   */
  declare headerToItem: ItemsSet<T>[];

  constructor(_entityApi: HeaderSetApi<T>) {
    super(_entityApi);
  }
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
