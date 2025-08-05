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
  defaultDeSerializers,
  DefaultDeSerializers,
  DeSerializers,
  AllFields,
  entityBuilder,
  EntityBuilderType,
  EntityApi,
  FieldBuilder,
  OrderableEdmTypeField,
  Link
} from '@sap-cloud-sdk/odata-v2';
export class HeaderSetApi<
  DeSerializersT extends DeSerializers = DefaultDeSerializers
> implements EntityApi<HeaderSet<DeSerializersT>, DeSerializersT>
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
  ): HeaderSetApi<DeSerializersT> {
    return new HeaderSetApi(deSerializers);
  }

  private navigationPropertyFields!: {
    /**
     * Static representation of the one-to-many navigation property {@link headerToItem} for query construction.
     * Use to reference this property in query operations such as 'select' in the fluent request API.
     */
    HEADER_TO_ITEM: Link<
      HeaderSet<DeSerializersT>,
      DeSerializersT,
      ItemsSetApi<DeSerializersT>
    >;
  };

  _addNavigationProperties(linkedApis: [ItemsSetApi<DeSerializersT>]): this {
    this.navigationPropertyFields = {
      HEADER_TO_ITEM: new Link('HeaderToItem', this, linkedApis[0])
    };
    return this;
  }

  entityConstructor = HeaderSet;

  requestBuilder(): HeaderSetRequestBuilder<DeSerializersT> {
    return new HeaderSetRequestBuilder<DeSerializersT>(this);
  }

  entityBuilder(): EntityBuilderType<
    HeaderSet<DeSerializersT>,
    DeSerializersT
  > {
    return entityBuilder<HeaderSet<DeSerializersT>, DeSerializersT>(this);
  }

  customField<NullableT extends boolean = false>(
    fieldName: string,
    isNullable: NullableT = false as NullableT
  ): CustomField<HeaderSet<DeSerializersT>, DeSerializersT, NullableT> {
    return new CustomField(
      fieldName,
      this.entityConstructor,
      this.deSerializers,
      isNullable
    ) as any;
  }

  private _fieldBuilder?: FieldBuilder<typeof HeaderSet, DeSerializersT>;
  get fieldBuilder() {
    if (!this._fieldBuilder) {
      this._fieldBuilder = new FieldBuilder(HeaderSet, this.deSerializers);
    }
    return this._fieldBuilder;
  }

  private _schema?: {
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

  get schema() {
    if (!this._schema) {
      const fieldBuilder = this.fieldBuilder;
      this._schema = {
        /**
         * Static representation of the {@link status} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        STATUS: fieldBuilder.buildEdmTypeField('STATUS', 'Edm.String', true),
        /**
         * Static representation of the {@link waers} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        WAERS: fieldBuilder.buildEdmTypeField('WAERS', 'Edm.String', true),
        /**
         * Static representation of the {@link bldat} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        BLDAT: fieldBuilder.buildEdmTypeField('BLDAT', 'Edm.DateTime', true),
        /**
         * Static representation of the {@link ktext} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        KTEXT: fieldBuilder.buildEdmTypeField('KTEXT', 'Edm.String', false),
        /**
         * Static representation of the {@link retMsg} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        RET_MSG: fieldBuilder.buildEdmTypeField('RET_MSG', 'Edm.String', true),
        /**
         * Static representation of the {@link belnr} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        BELNR: fieldBuilder.buildEdmTypeField('BELNR', 'Edm.String', true),
        ...this.navigationPropertyFields,
        /**
         *
         * All fields selector.
         */
        ALL_FIELDS: new AllFields('*', HeaderSet)
      };
    }

    return this._schema;
  }
}
