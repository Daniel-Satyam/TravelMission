"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemsSetApi = void 0;
/*
 * Copyright (c) 2025 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */
const ItemsSet_1 = require("./ItemsSet");
const ItemsSetRequestBuilder_1 = require("./ItemsSetRequestBuilder");
const odata_v2_1 = require("@sap-cloud-sdk/odata-v2");
class ItemsSetApi {
    constructor(deSerializers = odata_v2_1.defaultDeSerializers) {
        this.entityConstructor = ItemsSet_1.ItemsSet;
        this.deSerializers = deSerializers;
    }
    /**
     * Do not use this method or the constructor directly.
     * Use the service function as described in the documentation to get an API instance.
     */
    static _privateFactory(deSerializers = odata_v2_1.defaultDeSerializers) {
        return new ItemsSetApi(deSerializers);
    }
    _addNavigationProperties(linkedApis) {
        this.navigationPropertyFields = {};
        return this;
    }
    requestBuilder() {
        return new ItemsSetRequestBuilder_1.ItemsSetRequestBuilder(this);
    }
    entityBuilder() {
        return (0, odata_v2_1.entityBuilder)(this);
    }
    customField(fieldName, isNullable = false) {
        return new odata_v2_1.CustomField(fieldName, this.entityConstructor, this.deSerializers, isNullable);
    }
    get fieldBuilder() {
        if (!this._fieldBuilder) {
            this._fieldBuilder = new odata_v2_1.FieldBuilder(ItemsSet_1.ItemsSet, this.deSerializers);
        }
        return this._fieldBuilder;
    }
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
                ALL_FIELDS: new odata_v2_1.AllFields('*', ItemsSet_1.ItemsSet)
            };
        }
        return this._schema;
    }
}
exports.ItemsSetApi = ItemsSetApi;
//# sourceMappingURL=ItemsSetApi.js.map