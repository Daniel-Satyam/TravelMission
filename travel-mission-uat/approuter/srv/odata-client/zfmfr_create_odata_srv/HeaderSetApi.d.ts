/*
 * Copyright (c) 2025 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */
import { HeaderSet } from './HeaderSet';
import { HeaderSetRequestBuilder } from './HeaderSetRequestBuilder';
import { ItemsSetApi } from './ItemsSetApi';
import {
  CustomField,
  DefaultDeSerializers,
  DeSerializers,
  AllFields,
  EntityBuilderType,
  EntityApi,
  FieldBuilder,
  OrderableEdmTypeField,
  Link
} from '@sap-cloud-sdk/odata-v2';
export declare class HeaderSetApi<
  DeSerializersT extends DeSerializers = DefaultDeSerializers
> implements EntityApi<HeaderSet<DeSerializersT>, DeSerializersT>
{
  deSerializers: DeSerializersT;
  private constructor();
  /**
   * Do not use this method or the constructor directly.
   * Use the service function as described in the documentation to get an API instance.
   */
  static _privateFactory<
    DeSerializersT extends DeSerializers = DefaultDeSerializers
  >(deSerializers?: DeSerializersT): HeaderSetApi<DeSerializersT>;
  private navigationPropertyFields;
  _addNavigationProperties(linkedApis: [ItemsSetApi<DeSerializersT>]): this;
  entityConstructor: typeof HeaderSet;
  requestBuilder(): HeaderSetRequestBuilder<DeSerializersT>;
  entityBuilder(): EntityBuilderType<HeaderSet<DeSerializersT>, DeSerializersT>;
  customField<NullableT extends boolean = false>(
    fieldName: string,
    isNullable?: NullableT
  ): CustomField<HeaderSet<DeSerializersT>, DeSerializersT, NullableT>;
  private _fieldBuilder?;
  get fieldBuilder(): FieldBuilder<typeof HeaderSet, DeSerializersT>;
  private _schema?;
  get schema(): {
    STATUS: OrderableEdmTypeField<
      HeaderSet<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    WAERS: OrderableEdmTypeField<
      HeaderSet<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    BLDAT: OrderableEdmTypeField<
      HeaderSet<DeSerializers>,
      DeSerializersT,
      'Edm.DateTime',
      true,
      true
    >;
    KTEXT: OrderableEdmTypeField<
      HeaderSet<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      false,
      true
    >;
    RET_MSG: OrderableEdmTypeField<
      HeaderSet<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    BELNR: OrderableEdmTypeField<
      HeaderSet<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    /**
     * Static representation of the one-to-many navigation property {@link headerToItem} for query construction.
     * Use to reference this property in query operations such as 'select' in the fluent request API.
     */
    HEADER_TO_ITEM: Link<
      HeaderSet<DeSerializersT>,
      DeSerializersT,
      ItemsSetApi<DeSerializersT>
    >;
    ALL_FIELDS: AllFields<HeaderSet<DeSerializers>>;
  };
}
