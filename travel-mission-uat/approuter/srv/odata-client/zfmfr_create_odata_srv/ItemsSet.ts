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
export class ItemsSet<T extends DeSerializers = DefaultDeSerializers>
  extends Entity
  implements ItemsSetType<T>
{
  /**
   * Technical entity name for ItemsSet.
   */
  static override _entityName = 'ItemsSet';
  /**
   * Default url path for the according service.
   */
  static override _defaultBasePath =
    '/sap/opu/odata/sap/ZFMFR_CREATE_ODATA_SRV';
  /**
   * All key fields of the ItemsSet entity.
   */
  static _keys = ['BLPOS', 'KOSTL', 'WRBTR', 'PTEXT'];
  /**
   * Document item.
   * Maximum length: 3.
   */
  declare blpos: DeserializedType<T, 'Edm.String'>;
  /**
   * Cost Center.
   * Maximum length: 10.
   */
  declare kostl: DeserializedType<T, 'Edm.String'>;
  /**
   * Amount.
   */
  declare wrbtr: DeserializedType<T, 'Edm.Decimal'>;
  /**
   * Text.
   * Maximum length: 50.
   */
  declare ptext: DeserializedType<T, 'Edm.String'>;

  constructor(_entityApi: ItemsSetApi<T>) {
    super(_entityApi);
  }
}

export interface ItemsSetType<T extends DeSerializers = DefaultDeSerializers> {
  blpos: DeserializedType<T, 'Edm.String'>;
  kostl: DeserializedType<T, 'Edm.String'>;
  wrbtr: DeserializedType<T, 'Edm.Decimal'>;
  ptext: DeserializedType<T, 'Edm.String'>;
}
