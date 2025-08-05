"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeaderSetRequestBuilder = void 0;
/*
 * Copyright (c) 2025 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */
const odata_v2_1 = require("@sap-cloud-sdk/odata-v2");
const HeaderSet_1 = require("./HeaderSet");
/**
 * Request builder class for operations supported on the {@link HeaderSet} entity.
 */
class HeaderSetRequestBuilder extends odata_v2_1.RequestBuilder {
    /**
     * Returns a request builder for querying all `HeaderSet` entities.
     * @returns A request builder for creating requests to retrieve all `HeaderSet` entities.
     */
    getAll() {
        return new odata_v2_1.GetAllRequestBuilder(this.entityApi);
    }
    /**
     * Returns a request builder for creating a `HeaderSet` entity.
     * @param entity The entity to be created
     * @returns A request builder for creating requests that create an entity of type `HeaderSet`.
     */
    create(entity) {
        return new odata_v2_1.CreateRequestBuilder(this.entityApi, entity);
    }
    /**
     * Returns a request builder for retrieving one `HeaderSet` entity based on its keys.
     * @param ktext Key property. See {@link HeaderSet.ktext}.
     * @returns A request builder for creating requests to retrieve one `HeaderSet` entity based on its keys.
     */
    getByKey(ktext) {
        return new odata_v2_1.GetByKeyRequestBuilder(this.entityApi, {
            KTEXT: ktext
        });
    }
    /**
     * Returns a request builder for updating an entity of type `HeaderSet`.
     * @param entity The entity to be updated
     * @returns A request builder for creating requests that update an entity of type `HeaderSet`.
     */
    update(entity) {
        return new odata_v2_1.UpdateRequestBuilder(this.entityApi, entity);
    }
    delete(ktextOrEntity) {
        return new odata_v2_1.DeleteRequestBuilder(this.entityApi, ktextOrEntity instanceof HeaderSet_1.HeaderSet
            ? ktextOrEntity
            : { KTEXT: ktextOrEntity });
    }
}
exports.HeaderSetRequestBuilder = HeaderSetRequestBuilder;
//# sourceMappingURL=HeaderSetRequestBuilder.js.map