/*
 * Copyright (c) 2025 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */
import { ItemsSet } from './ItemsSet';
import { ItemsSetRequestBuilder } from './ItemsSetRequestBuilder';
import {
  CustomField,
  DefaultDeSerializers,
  DeSerializers,
  AllFields,
  EntityBuilderType,
  EntityApi,
  FieldBuilder,
  OrderableEdmTypeField
} from '@sap-cloud-sdk/odata-v2';
export declare class ItemsSetApi<
  DeSerializersT extends DeSerializers = DefaultDeSerializers
> implements EntityApi<ItemsSet<DeSerializersT>, DeSerializersT>
{
  deSerializers: DeSerializersT;
  private constructor();
  /**
   * Do not use this method or the constructor directly.
   * Use the service function as described in the documentation to get an API instance.
   */
  static _privateFactory<
    DeSerializersT extends DeSerializers = DefaultDeSerializers
  >(deSerializers?: DeSerializersT): ItemsSetApi<DeSerializersT>;
  private navigationPropertyFields;
  _addNavigationProperties(linkedApis: []): this;
  entityConstructor: typeof ItemsSet;
  requestBuilder(): ItemsSetRequestBuilder<DeSerializersT>;
  entityBuilder(): EntityBuilderType<ItemsSet<DeSerializersT>, DeSerializersT>;
  customField<NullableT extends boolean = false>(
    fieldName: string,
    isNullable?: NullableT
  ): CustomField<ItemsSet<DeSerializersT>, DeSerializersT, NullableT>;
  private _fieldBuilder?;
  get fieldBuilder(): FieldBuilder<typeof ItemsSet, DeSerializersT>;
  private _schema?;
  get schema(): {
    BLPOS: OrderableEdmTypeField<
      ItemsSet<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      false,
      true
    >;
    KOSTL: OrderableEdmTypeField<
      ItemsSet<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      false,
      true
    >;
    WRBTR: OrderableEdmTypeField<
      ItemsSet<DeSerializers>,
      DeSerializersT,
      'Edm.Decimal',
      false,
      true
    >;
    PTEXT: OrderableEdmTypeField<
      ItemsSet<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      false,
      true
    >;
    ALL_FIELDS: AllFields<ItemsSet<DeSerializers>>;
  };
}
