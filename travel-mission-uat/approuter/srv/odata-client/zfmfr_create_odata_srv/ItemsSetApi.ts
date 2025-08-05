/*
 * Copyright (c) 2025 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */
import { ItemsSet } from './ItemsSet';
import { ItemsSetRequestBuilder } from './ItemsSetRequestBuilder';
import {
  CustomField,
  defaultDeSerializers,
  DefaultDeSerializers,
  DeSerializers,
  AllFields,
  entityBuilder,
  EntityBuilderType,
  EntityApi,
  FieldBuilder,
  OrderableEdmTypeField
} from '@sap-cloud-sdk/odata-v2';
export class ItemsSetApi<
  DeSerializersT extends DeSerializers = DefaultDeSerializers
> implements EntityApi<ItemsSet<DeSerializersT>, DeSerializersT>
{
  public deSerializers: DeSerializersT;

  private constructor(
    deSerializers: DeSerializersT = defaultDeSerializers as any
  ) {
    this.deSerializers = deSerializers;
  }

  /**
   * Do not use this method or the constructor directly.
   * Use the service function as described in the documentation to get an API instance.
   */
  public static _privateFactory<
    DeSerializersT extends DeSerializers = DefaultDeSerializers
  >(
    deSerializers: DeSerializersT = defaultDeSerializers as any
  ): ItemsSetApi<DeSerializersT> {
    return new ItemsSetApi(deSerializers);
  }

  private navigationPropertyFields!: {};

  _addNavigationProperties(linkedApis: []): this {
    this.navigationPropertyFields = {};
    return this;
  }

  entityConstructor = ItemsSet;

  requestBuilder(): ItemsSetRequestBuilder<DeSerializersT> {
    return new ItemsSetRequestBuilder<DeSerializersT>(this);
  }

  entityBuilder(): EntityBuilderType<ItemsSet<DeSerializersT>, DeSerializersT> {
    return entityBuilder<ItemsSet<DeSerializersT>, DeSerializersT>(this);
  }

  customField<NullableT extends boolean = false>(
    fieldName: string,
    isNullable: NullableT = false as NullableT
  ): CustomField<ItemsSet<DeSerializersT>, DeSerializersT, NullableT> {
    return new CustomField(
      fieldName,
      this.entityConstructor,
      this.deSerializers,
      isNullable
    ) as any;
  }

  private _fieldBuilder?: FieldBuilder<typeof ItemsSet, DeSerializersT>;
  get fieldBuilder() {
    if (!this._fieldBuilder) {
      this._fieldBuilder = new FieldBuilder(ItemsSet, this.deSerializers);
    }
    return this._fieldBuilder;
  }

  private _schema?: {
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

  get schema() {
    if (!this._schema) {
      const fieldBuilder = this.fieldBuilder;
      this._schema = {
        /**
         * Static representation of the {@link blpos} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        BLPOS: fieldBuilder.buildEdmTypeField('BLPOS', 'Edm.String', false),
        /**
         * Static representation of the {@link kostl} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        KOSTL: fieldBuilder.buildEdmTypeField('KOSTL', 'Edm.String', false),
        /**
         * Static representation of the {@link wrbtr} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        WRBTR: fieldBuilder.buildEdmTypeField('WRBTR', 'Edm.Decimal', false),
        /**
         * Static representation of the {@link ptext} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        PTEXT: fieldBuilder.buildEdmTypeField('PTEXT', 'Edm.String', false),
        ...this.navigationPropertyFields,
        /**
         *
         * All fields selector.
         */
        ALL_FIELDS: new AllFields('*', ItemsSet)
      };
    }

    return this._schema;
  }
}
