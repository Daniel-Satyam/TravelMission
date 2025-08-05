"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.zfmfrCreateOdataSrv = zfmfrCreateOdataSrv;
/*
 * Copyright (c) 2025 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */
const HeaderSetApi_1 = require("./HeaderSetApi");
const ItemsSetApi_1 = require("./ItemsSetApi");
const odata_v2_1 = require("@sap-cloud-sdk/odata-v2");
const BatchRequest_1 = require("./BatchRequest");
function zfmfrCreateOdataSrv(deSerializers = odata_v2_1.defaultDeSerializers) {
    return new ZfmfrCreateOdataSrv((0, odata_v2_1.mergeDefaultDeSerializersWith)(deSerializers));
}
class ZfmfrCreateOdataSrv {
    constructor(deSerializers) {
        this.apis = {};
        this.deSerializers = deSerializers;
    }
    initApi(key, entityApi) {
        if (!this.apis[key]) {
            this.apis[key] = entityApi._privateFactory(this.deSerializers);
        }
        return this.apis[key];
    }
    get headerSetApi() {
        const api = this.initApi('headerSetApi', HeaderSetApi_1.HeaderSetApi);
        const linkedApis = [this.initApi('itemsSetApi', ItemsSetApi_1.ItemsSetApi)];
        api._addNavigationProperties(linkedApis);
        return api;
    }
    get itemsSetApi() {
        return this.initApi('itemsSetApi', ItemsSetApi_1.ItemsSetApi);
    }
    get batch() {
        return BatchRequest_1.batch;
    }
    get changeset() {
        return BatchRequest_1.changeset;
    }
}
//# sourceMappingURL=service.js.map