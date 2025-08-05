"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeaderSetApi = void 0;
/*
 * Copyright (c) 2025 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */
const HeaderSet_1 = require("./HeaderSet");
const HeaderSetRequestBuilder_1 = require("./HeaderSetRequestBuilder");
const odata_v2_1 = require("@sap-cloud-sdk/odata-v2");
class HeaderSetApi {
    constructor(deSerializers = odata_v2_1.defaultDeSerializers) {
        this.entityConstructor = HeaderSet_1.HeaderSet;
        this.deSerializers = deSerializers;
    }
    /**
     * Do not use this method or the constructor directly.
     * Use the service function as described in the documentation to get an API instance.
     */
    static _privateFactory(deSerializers = odata_v2_1.defaultDeSerializers) {
        return new HeaderSetApi(deSerializers);
    }
    _addNavigationProperties(linkedApis) {
        this.navigationPropertyFields = {
            HEADER_TO_ITEM: new odata_v2_1.Link('HeaderToItem', this, linkedApis[0])
        };
        return this;
    }
    requestBuilder() {
        return new HeaderSetRequestBuilder_1.HeaderSetRequestBuilder(this);
    }
    entityBuilder() {
        return (0, odata_v2_1.entityBuilder)(this);
    }
    customField(fieldName, isNullable = false) {
        return new odata_v2_1.CustomField(fieldName, this.entityConstructor, this.deSerializers, isNullable);
    }
    get fieldBuilder() {
        if (!this._fieldBuilder) {
            this._fieldBuilder = new odata_v2_1.FieldBuilder(HeaderSet_1.HeaderSet, this.deSerializers);
        }
        return this._fieldBuilder;
    }
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
                ALL_FIELDS: new odata_v2_1.AllFields('*', HeaderSet_1.HeaderSet)
            };
        }
        return this._schema;
    }
}
exports.HeaderSetApi = HeaderSetApi;
//# sourceMappingURL=HeaderSetApi.js.map