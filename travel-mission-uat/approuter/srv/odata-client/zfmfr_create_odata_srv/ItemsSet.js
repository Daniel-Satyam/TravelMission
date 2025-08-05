"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemsSet = void 0;
/*
 * Copyright (c) 2025 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */
const odata_v2_1 = require("@sap-cloud-sdk/odata-v2");
/**
 * This class represents the entity "ItemsSet" of service "ZFMFR_CREATE_ODATA_SRV".
 */
class ItemsSet extends odata_v2_1.Entity {
    constructor(_entityApi) {
        super(_entityApi);
    }
}
exports.ItemsSet = ItemsSet;
/**
 * Technical entity name for ItemsSet.
 */
ItemsSet._entityName = 'ItemsSet';
/**
 * Default url path for the according service.
 */
ItemsSet._defaultBasePath = '/sap/opu/odata/sap/ZFMFR_CREATE_ODATA_SRV';
/**
 * All key fields of the ItemsSet entity.
 */
ItemsSet._keys = ['BLPOS', 'KOSTL', 'WRBTR', 'PTEXT'];
//# sourceMappingURL=ItemsSet.js.map