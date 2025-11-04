sap.ui.define(["sap/ui/core/Control"], function (Control) {
  "use strict";

  /**
   * Constructor for a new MultiSelectComboBox.
   *
   * @param {string} [sId] ID for the new control, generated automatically if no ID is given
   * @param {object} [mSettings] Initial settings for the new control
   *
   * @class
   * A custom multi-select combobox control that allows selection of multiple items with configurable min/max limits
   * @extends sap.ui.core.Control
   *
   * @constructor
   * @public
   * @alias custom.control.MultiSelectComboBox
   */
  return Control.extend("ui5app.ui.MultiSelectComboBox", {
    metadata: {
      properties: {
        /**
         * Placeholder text shown when no items are selected
         */
        placeholder: { type: "string", defaultValue: "Select entities" },

        /**
         * Placeholder text shown when no items are selected
         */
        searchPlaceholder: { type: "string", defaultValue: "Search" },

        /**
         * Minimum number of items that must be selected
         */
        minSelection: { type: "int", defaultValue: 1 },

        /**
         * Maximum number of items that can be selected
         */
        maxSelection: { type: "int", defaultValue: 5 },

        /**
         * Whether the control is enabled
         */
        enabled: { type: "boolean", defaultValue: true },

        /**
         * Width of the control
         */
        width: { type: "sap.ui.core.CSSSize", defaultValue: "100%" },

        /**
         * Selected keys array
         */
        selectedKeys: { type: "string[]", defaultValue: [] },
      },

      aggregations: {
        /**
         * Items to be displayed in the combobox
         */
        items: {
          type: "sap.ui.core.Item",
          multiple: true,
          singularName: "item",
        },
      },

      defaultAggregation: "items",

      events: {
        /**
         * Fired when the selection changes
         */
        selectionChange: {
          parameters: {
            /**
             * Array of selected keys
             */
            selectedKeys: { type: "string[]" },

            /**
             * Array of selected items
             */
            selectedItems: { type: "sap.ui.core.Item[]" },
          },
        },
      },
    },

    init: function () {
      this._isOpen = false;
      this._searchValue = "";
      this._selectedItems = [];
      this._popoverId = this.getId() + "-popover";

      const sLibraryPath = jQuery.sap.getModulePath("ui5app"); //get the server location of the ui library
      jQuery.sap.includeStyleSheet(
        sLibraryPath + "/ui/MultiSelectComboBox.css"
      );
    },

    onAfterRendering: function () {
      this._createPopover();
      this._attachEventHandlers();
    },

    renderer: function (oRM, oControl) {
      const aItems = oControl.getItems();
      const aSelectedKeys = oControl.getSelectedKeys();
      const iMinSelection = oControl.getMinSelection();
      const iMaxSelection = oControl.getMaxSelection();
      const bEnabled = oControl.getEnabled();

      //--During rerender it should be reset
      if (oControl._isOpen) {
        oControl._closeDropdown();
      }

      // Main container
      oRM.openStart("div", oControl);
      oRM.class("sapUiCustomMultiSelectComboBox");
      oRM.style("width", oControl.getWidth());
      if (!bEnabled) {
        oRM.class("sapUiCustomMultiSelectComboBoxDisabled");
      }
      oRM.openEnd();

      // Header (selection display)
      oRM.openStart("div");
      oRM.class("sapUiCustomMultiSelectHeader");
      oRM.attr("data-sap-ui-part", "header");
      if (aSelectedKeys.length >= iMaxSelection) {
        oRM.class("sapUiCustomMultiSelectHeaderDisabled");
      }
      oRM.openEnd();

      if (aSelectedKeys.length === 0) {
        oRM.openStart("span");
        oRM.class("sapUiCustomMultiSelectPlaceholder");
        oRM.openEnd();
        oRM.text(oControl.getPlaceholder());
        oRM.close("span");
      } else {
        // Render selected tags
        aSelectedKeys.forEach(function (sKey) {
          const oItem = aItems.find(function (item) {
            return item.getKey() === sKey;
          });

          if (oItem) {
            oRM.openStart("div");
            oRM.class("sapUiCustomMultiSelectTag");
            oRM.attr("data-key", sKey);
            oRM.openEnd();

            oRM.openStart("span");
            oRM.openEnd();
            oRM.text(oItem.getText());
            oRM.close("span");

            oRM.openStart("button");
            oRM.class("sapUiCustomMultiSelectRemoveBtn");
            oRM.attr("data-key", sKey);
            oRM.attr("type", "button");
            oRM.openEnd();
            oRM.text("×");
            oRM.close("button");

            oRM.close("div");
          }
        });
      }

      oRM.close("div"); // header

      // Selection info
      // oRM.openStart("div");
      // oRM.class("sapUiCustomMultiSelectInfo");
      // oRM.attr("data-sap-ui-part", "selectionInfo");
      // oRM.openEnd();
      // oRM.text(oControl._getSelectionInfoText());
      // oRM.close("div");

      oRM.close("div"); // main container
    },

    _createPopover: function () {
      // Remove existing popover if any
      const oExistingPopover = document.getElementById(this._popoverId);
      if (oExistingPopover) {
        oExistingPopover.remove();
      }

      // Create popover div at document body level
      const oPopover = document.createElement("div");
      oPopover.id = this._popoverId;
      oPopover.className = "sapUiCustomMultiSelectDropdown";

      // Render dropdown content
      const aItems = this.getItems();
      const aSelectedKeys = this.getSelectedKeys();
      const iMaxSelection = this.getMaxSelection();

      let sHTML = '<div class="sapUiCustomMultiSelectSearchBox">';
      sHTML += `<input type="text" placeholder="${this.getSearchPlaceholder()}" class="sapUiCustomMultiSelectSearchInput" data-sap-ui-part="searchInput" />`;
      sHTML += "</div>";
      sHTML +=
        '<ul class="sapUiCustomMultiSelectOptionsList" data-sap-ui-part="optionsList">';

      aItems.forEach(function (oItem) {
        const sKey = oItem.getKey();
        const bSelected = aSelectedKeys.indexOf(sKey) > -1;
        const bDisabled = !bSelected && aSelectedKeys.length >= iMaxSelection;

        let sClasses = "sapUiCustomMultiSelectOption";
        if (bSelected) sClasses += " sapUiCustomMultiSelectOptionSelected";
        if (bDisabled) sClasses += " sapUiCustomMultiSelectOptionDisabled";

        sHTML += '<li class="' + sClasses + '" data-key="' + sKey + '">';
        sHTML +=
          '<input type="checkbox" ' +
          (bSelected ? "checked" : "") +
          (bDisabled ? " disabled" : "") +
          " />";
        sHTML += "<span>" + oItem.getText() + "</span>";
        sHTML += "</li>";
      });

      sHTML += "</ul>";

      oPopover.innerHTML = sHTML;
      document.body.appendChild(oPopover);

      // Attach popover-specific event handlers
      this._attachPopoverHandlers();
    },

    _attachPopoverHandlers: function () {
      const that = this;
      const oPopover = document.getElementById(this._popoverId);
      if (!oPopover) return;

      const oSearchInput = oPopover.querySelector(
        '[data-sap-ui-part="searchInput"]'
      );

      // Search input handler
      if (oSearchInput) {
        oSearchInput.addEventListener("input", function (e) {
          that._filterOptions(e.target.value);
        });
      }

      // Option item handlers
      const aOptions = oPopover.querySelectorAll(
        ".sapUiCustomMultiSelectOption"
      );
      aOptions.forEach(function (oOption) {
        if (
          !oOption.classList.contains("sapUiCustomMultiSelectOptionDisabled")
        ) {
          oOption.addEventListener("click", function () {
            const sKey = this.getAttribute("data-key");
            that._toggleSelection(sKey);
          });
        }
      });
    },

    _attachEventHandlers: function () {
      const that = this;
      const oDomRef = this.getDomRef();

      if (!oDomRef) return;

      const oHeader = oDomRef.querySelector('[data-sap-ui-part="header"]');

      // Toggle dropdown on header click
      if (oHeader) {
        oHeader.addEventListener("click", function (e) {
          if (!e.target.classList.contains("sapUiCustomMultiSelectRemoveBtn")) {
            that._toggleDropdown();
          }
        });
      }

      // Remove tag handlers
      const aRemoveBtns = oDomRef.querySelectorAll(
        ".sapUiCustomMultiSelectRemoveBtn"
      );
      aRemoveBtns.forEach(function (oBtn) {
        oBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          const sKey = this.getAttribute("data-key");
          that._removeItem(sKey);
        });
      });

      // Close dropdown when clicking outside
      this._documentClickHandler = function (e) {
        const oPopover = document.getElementById(that._popoverId);
        if (
          !oDomRef.contains(e.target) &&
          oPopover &&
          !oPopover.contains(e.target) &&
          !$(e.target).hasClass("sapUiCustomMultiSelectHeader") &&
          !$(e.target).parent().hasClass("sapUiCustomMultiSelectOption") &&
          !$(e.target).hasClass("sapUiCustomMultiSelectPlaceholder")
        ) {
          that._closeDropdown();
        }
      };
      document.addEventListener("click", this._documentClickHandler);
    },

    _toggleDropdown: function () {
      if (this._isOpen) {
        this._closeDropdown();
      } else {
        this._openDropdown();
      }
    },

    _openDropdown: function () {
      const oDomRef = this.getDomRef();
      if (!oDomRef) return;

      this._isOpen = true;
      const oPopover = document.getElementById(this._popoverId);
      const oHeader = oDomRef.querySelector('[data-sap-ui-part="header"]');

      // if (oPopover) {
      //   // Position the popover
      //   const oRect = oDomRef.getBoundingClientRect();
      //   oPopover.style.position = "fixed";
      //   oPopover.style.top = oRect.bottom + 10 + "px";
      //   oPopover.style.left = oRect.left + "px";
      //   oPopover.style.width = oRect.width + "px";
      //   oPopover.style.zIndex = "100";
      //   oPopover.style.boxSizing = "border-box";

      //   oPopover.classList.add("sapUiCustomMultiSelectDropdownOpen");

      //   const oSearchInput = oPopover.querySelector(
      //     '[data-sap-ui-part="searchInput"]'
      //   );
      //   if (oSearchInput) {
      //     oSearchInput.focus();
      //   }
      // }

      if (oPopover) {
        // Position the popover
        const oRect = oDomRef.getBoundingClientRect();

        // Check if RTL
        const bRTL =
          window.getComputedStyle(oDomRef).direction === "rtl" ||
          document.documentElement.dir === "rtl" ||
          document.body.dir === "rtl";

        oPopover.style.position = "fixed";
        oPopover.style.top = oRect.bottom + 10 + "px";
        oPopover.style.boxSizing = "border-box";

        if (bRTL) {
          // For RTL, align the right edge
          oPopover.style.right = window.innerWidth - oRect.right + "px";
          oPopover.style.left = "auto";
        } else {
          // For LTR, align the left edge
          oPopover.style.left = oRect.left + "px";
          oPopover.style.right = "auto";
        }

        oPopover.style.width = oRect.width + "px";
        oPopover.style.zIndex = "1000";

        oPopover.classList.add("sapUiCustomMultiSelectDropdownOpen");

        const oSearchInput = oPopover.querySelector(
          '[data-sap-ui-part="searchInput"]'
        );
        if (oSearchInput) {
          oSearchInput.focus();
        }
      }

      if (oHeader) {
        oHeader.classList.add("sapUiCustomMultiSelectHeaderOpen");
      }
    },

    _closeDropdown: function () {
      const oDomRef = this.getDomRef();
      if (!oDomRef) return;

      this._isOpen = false;
      const oPopover = document.getElementById(this._popoverId);
      const oHeader = oDomRef.querySelector('[data-sap-ui-part="header"]');

      if (oPopover) {
        oPopover.classList.remove("sapUiCustomMultiSelectDropdownOpen");

        const oSearchInput = oPopover.querySelector(
          '[data-sap-ui-part="searchInput"]'
        );
        if (oSearchInput) {
          oSearchInput.value = "";
        }
      }

      if (oHeader) {
        oHeader.classList.remove("sapUiCustomMultiSelectHeaderOpen");
      }

      this._filterOptions("");
    },

    _filterOptions: function (sSearchValue) {
      const oPopover = document.getElementById(this._popoverId);
      if (!oPopover) return;

      const aOptions = oPopover.querySelectorAll(
        ".sapUiCustomMultiSelectOption"
      );
      const sLowerSearch = sSearchValue.toLowerCase();

      aOptions.forEach(function (oOption) {
        const sText = oOption.textContent.toLowerCase();
        if (sText.includes(sLowerSearch)) {
          oOption.style.display = "";
        } else {
          oOption.style.display = "none";
        }
      });
    },

    _toggleSelection: function (sKey) {
      const aSelectedKeys = this.getSelectedKeys();
      const iIndex = aSelectedKeys.indexOf(sKey);

      if (iIndex > -1) {
        // Remove
        aSelectedKeys.splice(iIndex, 1);
      } else {
        // Add if under max limit
        if (aSelectedKeys.length < this.getMaxSelection()) {
          aSelectedKeys.push(sKey);
        }
      }

      this.setSelectedKeys(aSelectedKeys);
      this._fireSelectionChange();

      // Recreate popover to reflect new state
      this._createPopover();
      if (this._isOpen) {
        this._openDropdown();
      }
    },

    _removeItem: function (sKey) {
      const aSelectedKeys = this.getSelectedKeys();
      const iIndex = aSelectedKeys.indexOf(sKey);

      if (iIndex > -1) {
        aSelectedKeys.splice(iIndex, 1);
        this.setSelectedKeys(aSelectedKeys);
        this._fireSelectionChange();

        // Recreate popover to reflect new state
        this._createPopover();
        if (this._isOpen) {
          this._openDropdown();
        }
      }
    },

    _fireSelectionChange: function () {
      const aSelectedKeys = this.getSelectedKeys();
      const aItems = this.getItems();
      const aSelectedItems = aSelectedKeys
        .map(function (sKey) {
          return aItems.find(function (oItem) {
            return oItem.getKey() === sKey;
          });
        })
        .filter(function (item) {
          return item !== undefined;
        });

      this.fireSelectionChange({
        selectedKeys: aSelectedKeys,
        selectedItems: aSelectedItems,
      });
    },

    _getSelectionInfoText: function () {
      const iCount = this.getSelectedKeys().length;
      const iMin = this.getMinSelection();
      const iMax = this.getMaxSelection();

      if (iCount === 0) {
        return (
          "Please select at least " +
          iMin +
          " entity" +
          (iMin > 1 ? "ies" : "y")
        );
      } else if (iCount < iMin) {
        const iRemaining = iMin - iCount;
        return (
          "Select " +
          iRemaining +
          " more entit" +
          (iRemaining > 1 ? "ies" : "y") +
          " (minimum " +
          iMin +
          ")"
        );
      } else if (iCount >= iMax) {
        return "Maximum selection reached (" + iMax + " entities)";
      } else {
        return iCount + " of " + iMax + " selected";
      }
    },

    exit: function () {
      if (this._documentClickHandler) {
        document.removeEventListener("click", this._documentClickHandler);
      }

      // Remove popover from DOM
      const oPopover = document.getElementById(this._popoverId);
      if (oPopover) {
        oPopover.remove();
      }
    },
  });
});
