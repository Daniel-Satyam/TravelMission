"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemsSetRequestBuilder = void 0;
const odata_v2_1 = require("@sap-cloud-sdk/odata-v2");
const ItemsSet_1 = require("./ItemsSet");
/**
 * Request builder class for operations supported on the {@link ItemsSet} entity.
 */
class ItemsSetRequestBuilder extends odata_v2_1.RequestBuilder {
    /**
     * Returns a request builder for querying all `ItemsSet` entities.
     * @returns A request builder for creating requests to retrieve all `ItemsSet` entities.
     */
    getAll() {
        return new odata_v2_1.GetAllRequestBuilder(this.entityApi);
    }
    /**
     * Returns a request builder for creating a `ItemsSet` entity.
     * @param entity The entity to be created
     * @returns A request builder for creating requests that create an entity of type `ItemsSet`.
     */
    create(entity) {
        return new odata_v2_1.CreateRequestBuilder(this.entityApi, entity);
    }
    /**
     * Returns a request builder for retrieving one `ItemsSet` entity based on its keys.
     * @param blpos Key property. See {@link ItemsSet.blpos}.
     * @param kostl Key property. See {@link ItemsSet.kostl}.
     * @param wrbtr Key property. See {@link ItemsSet.wrbtr}.
     * @param ptext Key property. See {@link ItemsSet.ptext}.
     * @returns A request builder for creating requests to retrieve one `ItemsSet` entity based on its keys.
     */
    getByKey(blpos, kostl, wrbtr, ptext) {
        return new odata_v2_1.GetByKeyRequestBuilder(this.entityApi, {
            BLPOS: blpos,
            KOSTL: kostl,
            WRBTR: wrbtr,
            PTEXT: ptext
        });
    }
    /**
     * Returns a request builder for updating an entity of type `ItemsSet`.
     * @param entity The entity to be updated
     * @returns A request builder for creating requests that update an entity of type `ItemsSet`.
     */
    update(entity) {
        return new odata_v2_1.UpdateRequestBuilder(this.entityApi, entity);
    }
    delete(blposOrEntity, kostl, wrbtr, ptext) {
        return new odata_v2_1.DeleteRequestBuilder(this.entityApi, blposOrEntity instanceof ItemsSet_1.ItemsSet
            ? blposOrEntity
            : {
                BLPOS: blposOrEntity,
                KOSTL: kostl,
                WRBTR: wrbtr,
                PTEXT: ptext
            });
    }
}
exports.ItemsSetRequestBuilder = ItemsSetRequestBuilder;
//# sourceMappingURL=ItemsSetRequestBuilder.js.map