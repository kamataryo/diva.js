/*
Copyright (C) 2011 by Wendy Liu, Andrew Hankinson, Laurent Pugin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

window.divaPlugins = [];

// this pattern was taken from http://www.virgentech.com/blog/2009/10/building-object-oriented-jquery-plugin.html
(function ($) {
    var Diva = function (element, options) {
        // These are elements that can be overridden upon instantiation
        // See https://github.com/DDMAL/diva.js/wiki/Code-documentation for more details
        var defaults =  {
            adaptivePadding: 0.05,      // The ratio of padding to the page dimension
            contained: false,           // Determines the location of the fullscreen icon
            divaserveURL: '',           // URL to the divaserve.php script - *MANDATORY*
            enableAutoTitle: true,      // Shows the title within a div of id diva-title
            enableFilename: true,       // Uses filenames and not page numbers for links (i=bm_001.tif, not p=1)
            enableFullscreen: true,     // Enable or disable fullscreen icon (mode still available)
            enableGotoPage: true,       // A "go to page" jump box
            enableGrid: true,           // A grid view of all the pages
            enableGridSlider: true,     // Slider to control the pages per grid row
            enableKeyScroll: true,      // Scrolling using the page up/down keys
            enableLink: true,           // Controls the visibility of the link icon
            enableSpaceScroll: false,   // Scrolling down by pressing the space key
            enableZoomSlider: true,     // Enable or disable the zoom slider (for zooming in and out)
            fixedPadding: 10,           // Fallback if adaptive padding is set to 0
            fixedHeightGrid: true,      // So each page in grid view has the same height (only widths differ)
            goDirectlyTo: 0,            // Default initial page to show (0-indexed)
            iipServerURL: '',           // The URL to the IIPImage installation, including the `?FIF=` - *MANDATORY*
            inFullscreen: false,        // Set to true to load fullscreen mode initially
            inGrid: false,              // Set to true to load grid view initially
            imageDir: '',               // Image directory, relative to the root defined in divaserve - *MANDATORY*
            maxPagesPerRow: 8,          // Maximum number of pages per row, grid view
            maxZoomLevel: -1,           // Optional; defaults to the max zoom returned in the JSON response
            minPagesPerRow: 2,          // 2 for the spread view. Recommended to leave it
            minZoomLevel: 0,            // Defaults to 0 (the minimum zoom)
            onModeToggle: null,         // Callback for toggling fullscreen mode
            onViewToggle: null,         // Callback for switching between grid and document view
            onJump: null,               // Callback function for jumping to a specific page (using the gotoPage feature)
            onReady: null,              // Callback function for initial load
            onScroll: null,             // Callback function for scrolling
            onScrollDown: null,         // Callback function for scrolling down, only
            onScrollUp: null,           // Callback function for scrolling up only
            onZoom: null,               // Callback function for zooming in general
            onZoomIn: null,             // Callback function for zooming in only
            onZoomOut: null,            // Callback function for zooming out only
            pagesPerRow: 5,             // The default number of pages per row in grid view
            tileFadeSpeed: 0,           // The tile fade-in speed in ms (or "fast" or "slow"; 0 to disable)
            tileHeight: 256,            // The height of each tile, in pixels; usually 256
            tileWidth: 256,             // The width of each tile, in pixels; usually 256
            viewportMargin: 200,        // Pretend tiles +/- 200px away from viewport are in
            zoomLevel: 2                // The initial zoom level (used to store the current zoom level)
        };

        // Apply the defaults, or override them with passed-in options.
        var settings = $.extend({}, defaults, options);

        // Things that cannot be changed because of the way they are used by the script
        // Many of these are declared with arbitrary values that are changed later on
        var globals = {
            allTilesLoaded: [],         // A boolean for each page, indicating if all tiles have been loaded
            centerX: 0,                 // Only used if doubleClick is true - for zooming in
            centerY: 0,                 // Y-coordinate, see above
            ctrlKey: false,             // Hack for ctrl+double-clicking in Firefox on Mac
            currentPageIndex: 0,        // The current page in the viewport (center-most page)
            desiredXOffset: 0,          // Used for holding the 'x' hash parameter (x offset from left side of page)
            desiredYOffset: 0,          // Used for holding the 'y' hash parameter (y offset from top of page)
            dimAfterZoom: 0,            // Used for storing the item dimensions after zooming
            dimBeforeZoom: 0,           // Used for storing the item dimensions before zooming
            doubleClick: false,         // If the zoom has been triggered by a double-click event
            firstPageLoaded: -1,        // The ID of the first page loaded (value set later)
            firstRowLoaded: -1,         // The index of the first row loaded
            hashParamSuffix: '',        // Used when there are multiple document viewers on a page
            heightAbovePages: [],       // The height above each page
            horizontalOffset: 0,        // Used in documentScroll for scrolling more precisely
            horizontalPadding: 0,       // Either the fixed padding or adaptive padding
            ID: null,                   // The prefix of the IDs of the elements (usually 1-diva-)
            itemTitle: '',              // The title of the document
            lastPageLoaded: -1,         // The ID of the last page loaded (value set later)
            lastRowLoaded: -1,          // The index of the last row loaded
            leftScrollSoFar: 0,         // Current scroll from the left edge of the pane
            maxHeight: 0,               // The height of the tallest page
            maxWidth: 0,                // The width of the widest page
            minRatio: 0,                // The minimum height/width ratio for a page
            maxRatio: 0,                // The max height/width ratio (for grid view)
            mobileSafari: false,        // Checks if the user is on an iPad, iPhone or iPod
            numClicks: 0,               // Hack for ctrl+double-clicking in Firefox on Mac
            numPages: 0,                // Number of pages in the array
            numPlugins: 0,              // Holds the number of initialised plugins
            numRows: 0,                 // Number of rows
            pageLoadTimeout: 200,       // Number of milliseconds to wait before loading pages
            pages: [],                  // An array containing the data for all the pages
            pageLeftOffsets: [],        // Offset from the left side of the pane to the edge of the page
            pageTimeouts: [],           // Stack to hold the loadPage timeouts
            pageTools: '',              // The string for page tools
            panelHeight: 0,             // Height of the panel. Set in initiateViewer()
            panelWidth: 0,              // Width of the panel. Set in initiateViewer()
            plugins: [],                // Filled with the not disabled plugins in window.divaPlugins
            prevVptTop: 0,              // Used to determine vertical scroll direction
            realMaxZoom: -1,            // To hold the true max zoom level of the document
            rowLoadTimeout: 50,         // Less than for page loading
            scaleWait: false,           // For preventing double-scale on the iPad
            selector: '',               // Uses the generated ID prefix to easily select elements
            scrollbarWidth: 0,          // Set to the actual scrollbar width in init()
            scrollLeft: -1,             // Total scroll from the left
            scrollSoFar: 0,             // Holds the number of pixels of vertical scroll
            scrollTop: -1,              // Total scroll from the top
            totalHeight: 0,             // Height of all the image stacked together, value set later
            verticalOffset: 0,          // See horizontalOffset
            verticalPadding: 0,         // Either the fixed padding or adaptive padding
            viewerXOffset: 0,           // Distance between left edge of viewer and document left edge
            viewerYOffset: 0            // ^ for top edges
        };

        $.extend(settings, globals);

        // Executes a callback function with the diva instance set as the context
        // Can take an unlimited number to arguments to pass to the callback function
        var self = this;
        var executeCallback = function (callback) {
            if (typeof callback == "function") {
                var args = [];
                for (var i = 1, length = arguments.length; i < length; i++) {
                    args.push(arguments[i]);
                }

                callback.apply(self, args);
                return true;
            } else {
                return false;
            }
        };



        var getPageData = function (pageIndex, attribute) {
            return settings.pages[pageIndex]['d'][settings.zoomLevel][attribute];
        };

        // Returns the page index associated with the given filename; must called after settings settings.pages
        var getPageIndex = function (filename) {
            for (var i = 0; i < settings.numPages; i++) {
                if (settings.pages[i].f == filename) {
                    return i;
                }
            }

            return -1;
        };



        // Checks if a tile is within the viewport horizontally
        var horizontallyInViewport = function (left, right) {
            var panelWidth = settings.panelWidth;
            var leftOfViewport = settings.leftScrollSoFar - settings.viewportMargin;
            var rightOfViewport = leftOfViewport + panelWidth + settings.viewportMargin * 2;

            var leftVisible = left >= leftOfViewport && left <= rightOfViewport;
            var rightVisible = right >= leftOfViewport && right <= rightOfViewport;
            var middleVisible = left <= leftOfViewport && right >= rightOfViewport;

            return (leftVisible || middleVisible || rightVisible);
        };

        // Checks if a page or tile is within the viewport vertically
        var verticallyInViewport = function (top, bottom) {
            var panelHeight = settings.panelHeight;
            var topOfViewport = settings.scrollSoFar - settings.viewportMargin;
            var bottomOfViewport = topOfViewport + panelHeight + settings.viewportMargin * 2;

            var topVisible = top >= topOfViewport && top <= bottomOfViewport;
            var middleVisible = top <= topOfViewport && bottom >= bottomOfViewport;
            var bottomVisible = bottom >= topOfViewport && bottom <= bottomOfViewport;

            return (topVisible || middleVisible || bottomVisible);
        };



        // Check if a tile is near the viewport and thus should be loaded
        var isTileVisible = function (pageIndex, tileRow, tileCol) {
            var tileTop = settings.heightAbovePages[pageIndex] + (tileRow * settings.tileHeight) + settings.verticalPadding;
            var tileBottom = tileTop + settings.tileHeight;
            var tileLeft = settings.pageLeftOffsets[pageIndex] + (tileCol * settings.tileWidth);
            var tileRight = tileLeft + settings.tileWidth;

            return verticallyInViewport(tileTop, tileBottom) && horizontallyInViewport(tileLeft, tileRight);
        };

        // Check if a tile has been appended to the DOM
        var isTileLoaded = function (pageIndex, tileNumber) {
            return $(settings.selector + 'tile-' + pageIndex + '-' + tileNumber).length > 0;
        };



        // Check if a page index is valid
        var isPageValid = function (pageIndex) {
            return pageIndex >= 0 && pageIndex < settings.numPages;
        };

        // Check if a page is in or near the viewport and thus should be loaded
        var isPageVisible = function (pageIndex) {
            var topOfPage = settings.heightAbovePages[pageIndex];
            var bottomOfPage = topOfPage + getPageData(pageIndex, 'h') + settings.verticalPadding;

            return verticallyInViewport(topOfPage, bottomOfPage);
        };

        // Check if a page has been appended to the DOM
        var isPageLoaded = function (pageIndex) {
            return $(settings.selector + 'page-' + pageIndex).length > 0;
        };

        // Appends the page directly into the document body, or loads the relevant tiles
        var loadPage = function (pageIndex) {
            // If the page and all of its tiles have been loaded, exit
            if (isPageLoaded(pageIndex) && settings.allTilesLoaded[pageIndex]) {
                return;
            }

            // Load some data for this page
            var filename = settings.pages[pageIndex].f;
            var width = getPageData(pageIndex, 'w');
            var height = getPageData(pageIndex, 'h');
            var heightFromTop = settings.heightAbovePages[pageIndex] + settings.verticalPadding;

            // If the page has not been loaded yet, append the div to the DOM
            if (!isPageLoaded(pageIndex)) {
                $(settings.innerSelector).append('<div id="' + settings.ID + 'page-' + pageIndex + '" style="top: ' + heightFromTop + 'px; width: ' + width + 'px; height: ' + height + 'px;" class="diva-document-page" title="Page ' + (pageIndex + 1) + '" data-index="' + pageIndex  + '" data-filename="' + filename + '">' + settings.pageTools + '</div>');
            }

            // There are still tiles to load, so try to load those (after a delay)
            settings.pageTimeouts.push(setTimeout(function () {
                // If the page is no longer in the viewport, don't load any tiles
                if (!isPageVisible(pageIndex)) {
                    return;
                }

                // Load some more data and initialise some variables
                var rows = getPageData(pageIndex, 'r');
                var cols = getPageData(pageIndex, 'c');
                var maxZoom = settings.pages[pageIndex].m;
                var baseURL = settings.iipServerURL + filename + '&amp;JTL=';
                var tilesToLoad = [];
                var content = [];
                var allTilesLoaded = true;
                var tileNumber = 0;

                // Calculate the width and height of outer tiles (non-standard dimensions)
                var lastHeight = height - (rows - 1) * settings.tileHeight;
                var lastWidth = width - (cols - 1) * settings.tileWidth;

                // Declare variables used within the loops
                var row, col, tileHeight, tileWidth, top, left, displayStyle, zoomLevel, imageURL;

                // Loop through all the tiles in this page
                for (row = 0; row < rows; row++) {
                    for (col = 0; col < cols; col++) {
                        top = row * settings.tileHeight;
                        left = col * settings.tileWidth;

                        // If there is a tile fade speed set, hide this tile initially
                        displayStyle = (settings.tileFadeSpeed) ? 'none' : 'inline';

                        // Adjust the zoom level based on the max zoom level of the page
                        zoomLevel = settings.zoomLevel + maxZoom - settings.realMaxZoom;

                        // If the tile is in the last row or column, its dimensions will be different
                        tileHeight = (row === rows - 1) ? lastHeight : settings.tileHeight;
                        tileWidth = (col === cols - 1) ? lastWidth : settings.tileWidth;

                        imageURL = baseURL + zoomLevel + ',' + tileNumber;

                        if (!isTileLoaded(pageIndex, tileNumber)) {
                            if (isTileVisible(pageIndex, row, col)) {
                                // The tile needs to be loaded, so load it
                                content.push('<div id="' + settings.ID + 'tile-' + pageIndex + '-' + tileNumber + '" style="' + displayStyle + '; position: absolute; top: ' + top + 'px; left: ' + left + 'px; background-image: url(\'' + imageURL + '\'); height: ' + tileHeight + 'px; width: ' + tileWidth + 'px;"></div>');

                                // Add it to the array of tiles to be faded in
                                tilesToLoad.push(tileNumber);
                            } else {
                                // The tile does not need to be loaded - not all have been loaded
                                allTilesLoaded = false;
                            }
                        }

                        tileNumber++;
                    }
                }

                settings.allTilesLoaded[pageIndex] = allTilesLoaded;

                // If there are any times to load, add them to the page
                if (tilesToLoad.length) {
                    $(settings.selector + 'page-' + pageIndex).append(content.join(''));

                    // If tileFadeSpeed is set, make the tiles we just appended fade in
                    for (var i = 0; i < tilesToLoad.length; i++) {
                        $(settings.selector + 'tile-' + pageIndex + '-' + tilesToLoad[i]).fadeIn(settings.tileFadeSpeed);
                    }
                }
            }, settings.pageLoadTimeout));
        };

        // Delete a page from the DOM; will occur when a page is scrolled out of the viewport
        var deletePage = function (pageIndex) {
            $(settings.selector + 'page-' + pageIndex).empty().remove();
        };

        // Check if the bottom of a page is above the top of a viewport (scrolling down)
        // For when you want to keep looping but don't want to load a specific page
        var pageAboveViewport = function (pageIndex) {
            var bottomOfPage = settings.heightAbovePages[pageIndex] + getPageData(pageIndex, 'h') + settings.verticalPadding;
            var topOfViewport = settings.scrollSoFar;

            return bottomOfPage < topOfViewport;
        };

        // Check if the top of a page is below the bottom of a viewport (scrolling up)
        var pageBelowViewport = function (pageIndex) {
            var topOfPage = settings.heightAbovePages[pageIndex];
            var bottomOfViewport = settings.scrollSoFar + settings.panelHeight;

            return topOfPage > bottomOfViewport;
        };

        // Called by adjust pages - determine what pages should be visible, and show them
        var attemptPageShow = function (pageIndex, direction) {
            if (direction > 0) {
                // Direction is positive - we're scrolling down
                if (isPageValid(pageIndex)) {
                    // If the page should be visible, then yes, add it
                    if (isPageVisible(pageIndex)) {
                        loadPage(pageIndex);

                        settings.lastPageLoaded = pageIndex;

                        // Recursively call this function until there's nothing to add
                        attemptPageShow(settings.lastPageLoaded + 1, direction);
                    } else if (pageAboveViewport(pageIndex)) {
                        //  If the page is below the viewport. try to load the next one
                        attemptPageShow(pageIndex + 1, direction);
                    }
                }
            } else {
                // Direction is negative - we're scrolling up
                if (isPageValid(pageIndex)) {
                    // If it's near the viewport, yes, add it
                    if (isPageVisible(pageIndex)) {
                        loadPage(pageIndex);

                        // Reset the first page loaded to this one
                        settings.firstPageLoaded = pageIndex;

                        // Recursively call this function until there's nothing to add
                        attemptPageShow(settings.firstPageLoaded - 1, direction);
                    } else if (pageBelowViewport(pageIndex)) {
                        // Attempt to call this on the next page, do not increment anything
                        attemptPageShow(pageIndex - 1, direction);
                    }
                }
            }
        };

        // Called by adjustPages - see what pages need to be hidden, and hide them
        var attemptPageHide = function (pageIndex, direction) {
            if (direction > 0) {
                // Scrolling down - see if this page needs to be deleted from the DOM
                if (isPageValid(pageIndex) && pageAboveViewport(pageIndex)) {
                    // Yes, delete it, reset the first page loaded
                    deletePage(pageIndex);
                    settings.firstPageLoaded = pageIndex + 1;

                    // Try to call this function recursively until there's nothing to delete
                    attemptPageHide(settings.firstPageLoaded, direction);
                }
            } else {
                // Direction must be negative (not 0 - see adjustPages), we're scrolling up
                if (isPageValid(pageIndex) && pageBelowViewport(pageIndex)) {
                    // Yes, delete it, reset the last page loaded
                    deletePage(pageIndex);
                    settings.lastPageLoaded = pageIndex - 1;

                    // Try to call this function recursively until there's nothing to delete
                    attemptPageHide(settings.lastPageLoaded, direction);
                }
            }
        };

        // Handles showing and hiding pages when the user scrolls
        var adjustPages = function (direction) {
            // Direction is negative, so we're scrolling up
            if (direction < 0) {
                attemptPageShow(settings.firstPageLoaded, direction);
                setCurrentPage(-1);
                attemptPageHide(settings.lastPageLoaded, direction);
            } else if (direction > 0) {
                // Direction is positive so we're scrolling down
                attemptPageShow(settings.lastPageLoaded, direction);
                setCurrentPage(1);
                attemptPageHide(settings.firstPageLoaded, direction);
            } else {
                // Horizontal scroll, check if we need to reveal any tiles
                for (var i = Math.max(settings.firstPageLoaded, 0); i <= settings.lastPageLoaded; i++) {
                    if (isPageVisible(i)) {
                        loadPage(i);
                    }
                }
            }

            executeCallback(settings.onScroll, settings.scrollSoFar);

            // If we're scrolling down
            if (direction > 0) {
                executeCallback(settings.onScrollDown, settings.scrollSoFar);
            } else if (direction < 0) {
                // We're scrolling up
                executeCallback(settings.onScrollUp, settings.scrollSoFar);
            }
        };



        // Check if a row index is valid
        var isRowValid = function (rowIndex) {
            return rowIndex >= 0 && rowIndex < settings.numRows;
        };

        // Check if a row should be visible in the viewport
        var isRowVisible = function (rowIndex) {
            var topOfRow = settings.rowHeight * rowIndex;
            var bottomOfRow = topOfRow + settings.rowHeight + settings.fixedPadding;

            return verticallyInViewport(topOfRow, bottomOfRow);
        };

        // Check if a row (in grid view) is present in the DOM
        var isRowLoaded = function (rowIndex) {
            return $(settings.selector + 'row-' + rowIndex).length > 0;
        };

        var loadRow = function (rowIndex) {
            // If the row has already been loaded, don't attempt to load it again
            if (isRowLoaded(rowIndex)) {
                return;
            }

            // Load some data for this and initialise some variables
            var heightFromTop = (settings.rowHeight * rowIndex) + settings.fixedPadding;
            var content = [];

            // Create the opening tag for the row div
            content.push('<div class="diva-row" id="' + settings.ID + 'row-' + rowIndex + '" style="height: ' + settings.rowHeight + '; top: ' + heightFromTop + 'px;">');

            // Declare variables used in the loop
            var i, pageIndex, filename, realWidth, realHeight, pageWidth, pageHeight, leftOffset, imageURL;

            // Load each page within that row
            for (i = 0; i < settings.pagesPerRow; i++) {
                pageIndex = rowIndex * settings.pagesPerRow + i;

                // If this page is the last row, don't try to load a nonexistent page
                if (!isPageValid(pageIndex)) {
                    break;
                }

                // Calculate the width, height and horizontal placement of this page
                filename = settings.pages[pageIndex].f;
                realWidth = getPageData(pageIndex, 'w');
                realHeight = getPageData(pageIndex, 'h');
                pageWidth = (settings.fixedHeightGrid) ? (settings.rowHeight - settings.fixedPadding) * realWidth / realHeight : settings.gridPageWidth;
                pageHeight = (settings.fixedHeightGrid) ? settings.rowHeight - settings.fixedPadding : pageWidth / realWidth * realHeight;
                leftOffset = parseInt(i * (settings.fixedPadding + settings.gridPageWidth) + settings.fixedPadding, 10);

                // Make sure they're all integers for nice, round numbers
                pageWidth = parseInt(pageWidth, 10);
                pageHeight = parseInt(pageHeight, 10);

                // Center the page if the height is fixed (otherwise, there is no horizontal padding)
                leftOffset += (settings.fixedHeightGrid) ? (settings.gridPageWidth - pageWidth) / 2 : 0;
                imageURL = settings.iipServerURL + filename + '&amp;HEI=' + (pageHeight + 2) + '&amp;CVT=JPG';

                // Append the HTML for this page to the string builder array
                content.push('<div id="' + settings.ID + 'page-' + pageIndex + '" class="diva-page" style="width: ' + pageWidth + 'px; height: ' + pageHeight + 'px; left: ' + leftOffset + 'px;" title="Page ' + (pageIndex + 1) + '"></div>');

                // Add each image to a queue so that images aren't loaded unnecessarily
                addPageToQueue(rowIndex, pageIndex, imageURL, pageWidth, pageHeight);
            }

            // Append this row to the DOM
            content.push('</div>');
            $(settings.innerSelector).append(content.join(''));
        };

        var deleteRow = function (rowIndex) {
            $(settings.selector + 'row-' + rowIndex).empty().remove();
        };

        // Check if the bottom of a row is above the top of the viewport (scrolling down)
        var rowAboveViewport = function (rowIndex) {
            var bottomOfRow = settings.rowHeight * (rowIndex + 1);
            var topOfViewport = settings.scrollSoFar;

            return (bottomOfRow < topOfViewport);
        };

        // Check if the top of a row is below the bottom of the viewport (scrolling up)
        var rowBelowViewport = function (rowIndex) {
            var topOfRow = settings.rowHeight * rowIndex;
            var bottomOfViewport = settings.scrollSoFar + settings.panelHeight;

            return (topOfRow > bottomOfViewport);
        };

        // Same thing as attemptPageShow only with rows
        var attemptRowShow = function (rowIndex, direction) {
            if (direction > 0) {
                if (isRowValid(rowIndex)) {
                    if (isRowVisible(rowIndex)) {
                        loadRow(rowIndex);
                        settings.lastRowLoaded = rowIndex;
                        attemptRowShow(settings.lastRowLoaded+1, direction);
                    } else if (rowAboveViewport(rowIndex)) {
                        attemptRowShow(rowIndex+1, direction);
                    }
                }
            } else {
                if (isRowValid(rowIndex)) {
                    if (isRowVisible(rowIndex)) {
                        loadRow(rowIndex);
                        settings.firstRowLoaded = rowIndex;
                        attemptRowShow(settings.firstRowLoaded-1, direction);
                    } else if (rowBelowViewport(rowIndex)) {
                        attemptRowShow(rowIndex-1, direction);
                    }
                }
            }
        };

        var attemptRowHide = function (rowIndex, direction) {
            if (direction > 0) {
                if (isRowValid(rowIndex) && rowAboveViewport(rowIndex)) {
                    deleteRow(rowIndex);
                    settings.firstRowLoaded++;
                    attemptRowHide(settings.firstRowLoaded, direction);
                }
            } else {
                if (isRowValid(rowIndex) && rowBelowViewport(rowIndex)) {
                    deleteRow(rowIndex);
                    settings.lastRowLoaded--;

                    attemptRowHide(settings.lastRowLoaded, direction);
                }
            }
        };

        var adjustRows = function (direction) {
            if (direction < 0) {
                attemptRowShow(settings.firstRowLoaded, -1);
                setCurrentRow(-1);
                attemptRowHide(settings.lastRowLoaded, -1);
            } else if (direction > 0) {
                attemptRowShow(settings.lastRowLoaded, 1);
                setCurrentRow(1);
                attemptRowHide(settings.firstRowLoaded, 1);
            }

            executeCallback(settings.onScroll, settings.scrollSoFar);

            // If we're scrolling down
            if (direction > 0) {
                executeCallback(settings.onScrollDown, settings.scrollSoFar);
            } else if (direction < 0) {
                // We're scrolling up
                executeCallback(settings.onScrollUp, settings.scrollSoFar);
            }
        };

        // Used to delay loading of page images in grid view to prevent unnecessary loads
        var addPageToQueue = function (rowIndex, pageIndex, imageURL, pageWidth, pageHeight) {
            settings.pageTimeouts.push(setTimeout(function () {
                if (isRowVisible(rowIndex)) {
                    $(settings.selector + 'page-' + pageIndex).html('<img src="' + imageURL + '" style="width: ' + pageWidth + 'px; height: ' + pageHeight + 'px;" />');
                }
            }, settings.rowLoadTimeout));
        };



        // Determines and sets the "current page" (settings.currentPageIndex); called within adjustPages
        // The "direction" can be 0, 1 or -1; 1 for down, -1 for up, and 0 to go straight to a specific page
        var setCurrentPage = function (direction) {
            var middleOfViewport = settings.scrollSoFar + (settings.panelHeight / 2);
            var currentPage = settings.currentPageIndex;
            var pageToConsider = settings.currentPageIndex + parseInt(direction, 10);
            var changeCurrentPage = false;

            // When scrolling up:
            if (direction < 0) {
                // If the previous page > middle of viewport
                if (pageToConsider >= 0 && (settings.heightAbovePages[pageToConsider] + getPageData(pageToConsider, 'h') + (settings.verticalPadding) >= middleOfViewport)) {
                    changeCurrentPage = true;
                }
            } else if (direction > 0) {
                // When scrolling down:
                // If this page < middle of viewport
                if (settings.heightAbovePages[currentPage] + getPageData(currentPage, 'h') + settings.verticalPadding < middleOfViewport) {
                    changeCurrentPage = true;
                }
            }

            if (changeCurrentPage) {
                // Set this to the current page
                settings.currentPageIndex = pageToConsider;

                // Now try to change the next page, given that we're not going to a specific page
                // Calls itself recursively - this way we accurately obtain the current page
                if (direction !== 0) {
                    if (!setCurrentPage(direction)) {
                        settings.toolbar.updateCurrentPage();
                    }
                }
                return true;
            } else {
                return false;
            }
        };

        // Sets the current page in grid view
        var setCurrentRow = function (direction) {
            var currentRow = Math.floor(settings.currentPageIndex / settings.pagesPerRow);
            var rowToConsider = currentRow + parseInt(direction, 10);
            var middleOfViewport = settings.scrollSoFar + (settings.panelHeight / 2);
            var changeCurrentRow = false;

            if (direction < 0) {
                if (rowToConsider >= 0 && (settings.rowHeight * currentRow >= middleOfViewport || settings.rowHeight * rowToConsider >= settings.scrollSoFar)) {
                    changeCurrentRow = true;
                }
            } else if (direction > 0) {
                if ((settings.rowHeight * (currentRow + 1)) < settings.scrollSoFar && isRowValid(rowToConsider)) {
                    changeCurrentRow = true;
                }
            }

            if (changeCurrentRow) {
                settings.currentPageIndex = rowToConsider * settings.pagesPerRow;

                if (direction !== 0) {
                    if (!setCurrentRow(direction)) {
                        settings.toolbar.updateCurrentPage();
                    }
                }

                return true;
            } else {
                return false;
            }
        };



        // Helper function for going to a particular page
        // Vertical offset: from the top of the page (including the top padding)
        // Horizontal offset: from the center of the page; can be negative if to the left
        var gotoPage = function(pageIndex, verticalOffset, horizontalOffset) {
            var desiredTop = settings.heightAbovePages[pageIndex] + verticalOffset;
            var desiredLeft = (settings.maxWidths[settings.zoomLevel] - settings.panelWidth) / 2 + settings.horizontalPadding + horizontalOffset;

            $(settings.outerSelector).scrollTop(desiredTop);
            $(settings.outerSelector).scrollLeft(desiredLeft);

            // Pretend that this is the current page
            settings.currentPageIndex = pageIndex;
            settings.toolbar.updateCurrentPage();
        };

        // Calculates the desired row, then scrolls there
        var gotoRow = function (pageIndex) {
            var desiredRow = Math.floor(pageIndex / settings.pagesPerRow);
            var desiredTop = desiredRow * settings.rowHeight;
            $(settings.outerSelector).scrollTop(desiredTop);

            // Pretend that this is the current page (it probably isn't)
            settings.currentPageIndex = pageIndex;
            settings.toolbar.updateCurrentPage();
        }



        // Helper function called by loadDocument to scroll to the desired place
        var documentScroll = function () {
            // If settings.preZoomOffset is defined, the zoom was trigged by double-clicking
            // We then zoom in on a specific region
            if (settings.preZoomOffset) {
                var clickedPage = settings.preZoomOffset.i;
                var heightAbovePage = settings.heightAbovePages[clickedPage] + settings.verticalPadding;
                var pageLeftOffset = settings.pageLeftOffsets[clickedPage];
                var zoomRatio = Math.pow(2, settings.zoomLevel - settings.oldZoomLevel);

                var distanceFromViewport = {
                    x: settings.preZoomOffset.originalX - settings.viewerXOffset,
                    y: settings.preZoomOffset.originalY - settings.viewerYOffset
                };

                var newDistanceToEdge = {
                    x: settings.preZoomOffset.x * zoomRatio,
                    y: settings.preZoomOffset.y * zoomRatio
                };

                var newScroll = {
                    x: newDistanceToEdge.x - distanceFromViewport.x + pageLeftOffset,
                    y: newDistanceToEdge.y - distanceFromViewport.y + heightAbovePage
                };

                $(settings.outerSelector).scrollTop(newScroll.y).scrollLeft(newScroll.x);

                settings.preZoomOffset = undefined;
            } else {
                // Otherwise, we just scroll to the page saved in settings.goDirectlyTo (must be valid)
                // We use the stored y/x offsets (relative to the top of the page and the center, respectively)
                gotoPage(settings.goDirectlyTo, settings.verticalOffset, settings.horizontalOffset)
                settings.horizontalOffset = 0;
                settings.verticalOffset = 0;
            }
        };

        // Don't call this when not in grid mode please
        // Scrolls to the relevant place when in grid view
        var gridScroll = function () {
            // Figure out and scroll to the row containing the current page
            gotoRow(settings.goDirectlyTo);
        };



        // If the given zoom level is valid, returns it; else, returns the min
        var getValidZoomLevel = function (zoomLevel) {
            return (zoomLevel >= settings.minZoomLevel && zoomLevel <= settings.maxZoomLevel) ? zoomLevel : settings.minZoomLevel;
        };

        var getValidPagesPerRow = function (pagesPerRow) {
            return (pagesPerRow >= settings.minPagesPerRow && pagesPerRow <= settings.maxPagesPerRow) ? pagesPerRow : settings.maxPagesPerRow;
        };



        // Reset some settings and empty the viewport
        var clearViewer = function () {
            settings.allTilesLoaded = [];
            $(settings.outerSelector).scrollTop(0);
            settings.scrollSoFar = 0;
            $(settings.innerSelector).empty();
            settings.firstPageLoaded = 0;
            settings.firstRowLoaded = -1;
            settings.prevVptTop = 0;

            // Clear all the timeouts to prevent undesired pages from loading
            while (settings.pageTimeouts.length) {
                clearTimeout(settings.pageTimeouts.pop());
            }
        };

        // Called when we don't necessarily know which view to go into
        var loadViewer = function () {
            if (settings.inGrid) {
                loadGrid();
            } else {
                loadDocument();
            }
        };

        // Called every time we need to load document view (after zooming, fullscreen, etc)
        var loadDocument = function () {
            clearViewer();

            // Make sure the zoom level we've been given is valid
            settings.zoomLevel = getValidZoomLevel(settings.zoomLevel);
            var z = settings.zoomLevel;

            // Calculate the horizontal and vertical inter-page padding
            if (settings.adaptivePadding > 0) {
                settings.horizontalPadding = settings.averageWidths[z] * settings.adaptivePadding;
                settings.verticalPadding = settings.averageHeights[z] * settings.adaptivePadding;
            } else {
                // It's less than or equal to 0; use fixedPadding instead
                settings.horizontalPadding = settings.fixedPadding;
                settings.verticalPadding = settings.fixedPadding;
            }

            // Make sure the vertical padding is at least 40, if plugins are enabled
            if (settings.plugins) {
                settings.verticalPadding = Math.max(40, settings.horizontalPadding);
            }

            // Now reset some things that need to be changed after each zoom
            settings.totalHeight = settings.totalHeights[z] + settings.verticalPadding * (settings.numPages + 1);
            settings.dimAfterZoom = settings.totalHeight;

            // Determine the width of the inner element (based on the max width)
            var widthToSet = (settings.maxWidths[z] + settings.horizontalPadding * 2 < settings.panelWidth ) ? settings.panelWidth : settings.maxWidths[z] + settings.horizontalPadding * 2;

            // Needed to set settings.heightAbovePages - initially just the top padding
            var heightSoFar = 0;

            for (var i = 0; i < settings.numPages; i++) {
                // First set the height above that page by adding this height to the previous total
                // A page includes the padding above it
                settings.heightAbovePages[i] = heightSoFar;

                // Has to be done this way otherwise you get the height of the page included too
                heightSoFar = settings.heightAbovePages[i] + getPageData(i, 'h') + settings.verticalPadding;

                // Figure out the pageLeftOffset stuff
                settings.pageLeftOffsets[i] = (widthToSet - getPageData(i, 'w')) / 2;

                // Now try to load the page ONLY if the page needs to be loaded
                // Take scrolling into account later, just try this for now
                if (isPageVisible(i)) {
                    loadPage(i);
                    settings.lastPageLoaded = i;
                }
            }

            // If this is not the initial load, execute the zoom callbacks
            if (settings.oldZoomLevel >= 0) {
                if (settings.oldZoomLevel > settings.zoomLevel) {
                    executeCallback(settings.onZoomIn, z);
                } else {
                    executeCallback(settings.onZoomOut, z);
                }

                executeCallback(settings.onZoom, z);
            }

            // Set the height and width of documentpane (necessary for dragscrollable)
            $(settings.innerSelector).css('height', Math.round(settings.totalHeight));
            $(settings.innerSelector).css('width', Math.round(widthToSet));

            // Scroll to the proper place
            documentScroll();

            // For the iPad - wait until this request finishes before accepting others
            if (settings.scaleWait) {
                settings.scaleWait = false;
            }
        };

        var loadGrid = function () {
            clearViewer();

            // Make sure the pages per row setting is valid
            settings.pagesPerRow = getValidPagesPerRow(settings.pagesPerRow);

            var horizontalPadding = settings.fixedPadding * (settings.pagesPerRow + 1);
            var pageWidth = (settings.panelWidth - horizontalPadding) / settings.pagesPerRow;
            settings.gridPageWidth = pageWidth;

            // Calculate the row height depending on whether we want to fix the width or the height
            settings.rowHeight = (settings.fixedHeightGrid) ? settings.fixedPadding + settings.minRatio * pageWidth : settings.fixedPadding + settings.maxRatio * pageWidth;
            settings.numRows = Math.ceil(settings.numPages / settings.pagesPerRow);
            settings.totalHeight = settings.numRows * settings.rowHeight + settings.fixedPadding;
            $(settings.innerSelector).css('height', Math.round(settings.totalHeight));
            $(settings.innerSelector).css('width', Math.round(settings.panelWidth));

            // First scroll directly to the row containing the current page
            gridScroll();

            var i, rowIndex;

            // Figure out the row each page is in
            for (i = 0; i < settings.numPages; i += settings.pagesPerRow) {
                rowIndex = Math.floor(i / settings.pagesPerRow);

                if (isRowVisible(rowIndex)) {
                    settings.firstRowLoaded = (settings.firstRowLoaded < 0) ? rowIndex : settings.firstRowLoaded;
                    loadRow(rowIndex);
                    settings.lastRowLoaded = rowIndex;
                }
            }
        };



        // The handle_Scrolls are called whenever there is a scroll event in the the #diva-outer element
        var handleDocumentScroll = function () {
            settings.scrollSoFar = $(settings.outerSelector).scrollTop();
            adjustPages(settings.scrollSoFar - settings.prevVptTop);
            settings.prevVptTop = settings.scrollSoFar;
        };

        var handleGridScroll = function () {
            settings.scrollSoFar = $(settings.outerSelector).scrollTop();
            adjustRows(settings.scrollSoFar - settings.prevVptTop);
            settings.prevVptTop = settings.scrollSoFar;
        };



        // Handles switching in and out of fullscreen mode
        // Should only be called after changing settings.inFullscreen
        var handleModeChange = function () {
            // Save some offsets (required for scrolling properly), if it's not the initial load
            if (settings.oldZoomLevel >= 0) {
                if (!settings.inGrid) {
                    var pageOffset = $(settings.selector + 'page-' + settings.currentPageIndex).offset();
                    var topOffset = -(pageOffset.top - settings.verticalPadding - settings.viewerYOffset);
                    var expectedLeft = (settings.panelWidth - getPageData(settings.currentPageIndex, 'w')) / 2;
                    var leftOffset = -(pageOffset.left - settings.viewerXOffset - expectedLeft);
                    settings.verticalOffset = topOffset;
                    settings.horizontalOffset = leftOffset;
                }
            }

            // Change the look of the toolbar
            settings.toolbar.switchMode();

            // Toggle the classes
            $(settings.selector + 'fullscreen').toggleClass('diva-in-fullscreen');
            $(settings.outerSelector).toggleClass('diva-fullscreen');
            $('body').toggleClass('diva-hide-scrollbar');
            $(settings.parentSelector).toggleClass('diva-full-width');

            // Reset the panel dimensions
            settings.panelHeight = $(settings.outerSelector).height();
            settings.panelWidth = $(settings.outerSelector).width() - settings.scrollbarWidth;
            $(settings.innerSelector).width(settings.panelWidth);

            // Recalculate the viewer offsets
            settings.viewerXOffset = $(settings.outerSelector).offset().left;
            settings.viewerYOffset = $(settings.outerSelector).offset().top;

            loadViewer();

            // Execute callbacks
        };

        // Handles switching in and out of grid view
        // Should only be called after changing settings.inGrid
        var handleViewChange = function () {
            // Switch the slider
            settings.toolbar.switchSlider();

            loadViewer();
            executeCallback(settings.onViewToggle);
        };



        // Called when the fullscreen icon is clicked
        var toggleFullscreenIcon = function () {
            if (settings.inGrid) {
                settings.gridScrollTop = settings.scrollSoFar;
            } else {
                settings.goDirectlyTo = settings.currentPageIndex;
            }

            settings.inFullscreen = !settings.inFullscreen;
            handleModeChange();
        };

        // Called when the grid icon is clicked
        var toggleGridIcon = function () {
            settings.goDirectlyTo = settings.currentPageIndex;
            settings.inGrid = !settings.inGrid;
            handleViewChange();
        };



        // Called after double-click or ctrl+double-click events on pages in document view
        var handleDocumentDoubleClick = function (event) {
            var pageOffset = $(this).offset();
            var offsetX = event.pageX - pageOffset.left;
            var offsetY = event.pageY - pageOffset.top;

            // Store the offset information so that it can be used in documentScroll()
            settings.preZoomOffset = {
                x: offsetX,
                y: offsetY,
                originalX: event.pageX,
                originalY: event.pageY,
                i: $(this).attr('data-index')
            };

            // Hold control to zoom out, otherwise, zoom in
            var newZoomLevel = (event.ctrlKey) ? settings.zoomLevel - 1 : settings.zoomLevel + 1;

            handleZoom(newZoomLevel);
        };


        // Called after double-clicking on a page in grid view
        var handleGridDoubleClick = function (event) {
            // Figure out the page that was clicked, scroll to that page
            var centerX = (event.pageX - settings.viewerXOffset) + $(settings.outerSelector).scrollLeft();
            var centerY = (event.pageY - settings.viewerYOffset) + $(settings.outerSelector).scrollTop();
            var rowIndex = Math.floor(centerY / settings.rowHeight);
            var colIndex = Math.floor(centerX / (settings.panelWidth / settings.pagesPerRow));
            var pageIndex = rowIndex * settings.pagesPerRow + colIndex;
            settings.goDirectlyTo = pageIndex;

            // Leave grid view, jump directly to the desired page
            settings.inGrid = false;
            handleViewChange();
        };

        // Handles pinch-zooming for mobile Safari
        var handlePinchZoom = function (event) {
            var newZoomLevel = settings.zoomLevel;

            // First figure out the new zoom level:
            if (event.scale > 1 && newZoomLevel < settings.maxZoomLevel) {
                newZoomLevel++;
            } else if (event.scale < 1 && newZoomLevel > settings.minZoomLevel) {
                newZoomLevel--;
            } else {
                return;
            }

            // Set it to true so we have to wait for this one to finish
            settings.scaleWait = true;

            // Has to call handleZoomSlide so that the coordinates are kept
            handleZoom(newZoomLevel);
        };



        // Called to handle any zoom level
        var handleZoom = function (newValue) {
            var newZoomLevel = getValidZoomLevel(newValue);

            // If the zoom level provided is invalid, return false
            if (newZoomLevel !== newValue) {
                return false;
            }

            settings.oldZoomLevel = settings.zoomLevel;
            settings.zoomLevel = newZoomLevel;

            // Update the slider
            settings.toolbar.updateZoomSlider();

            loadDocument();
            
            return true;
        };

        // Called to handle changing the pages per row slider
        var handleGrid = function (newValue) {
            var newPagesPerRow = getValidPagesPerRow(newValue);

            // If the value provided is invalid, return false
            if (newPagesPerRow !== newValue) {
                return false;
            }

            settings.oldPagesPerRow = settings.zoomLevel;
            settings.pagesPerRow = newPagesPerRow;

            // Update the slider
            settings.toolbar.updateGridSlider();

            loadGrid();
        };



        var getYOffset = function () {
            var yScroll = $(settings.outerSelector).scrollTop();
            var topOfPage = settings.heightAbovePages[settings.currentPageIndex];

            return parseInt(yScroll - topOfPage);
        };

        var getXOffset = function () {
            var innerWidth = settings.maxWidths[settings.zoomLevel] + settings.horizontalPadding * 2;
            var centerX = (innerWidth - settings.panelWidth) / 2;
            return parseInt($(settings.outerSelector).scrollLeft() - centerX);
        };

        var getState = function () {
            var state = {
                'f': settings.inFullscreen,
                'g': settings.inGrid,
                'z': settings.zoomLevel,
                'n': settings.pagesPerRow,
                'i': (settings.enableFilename) ? settings.pages[settings.currentPageIndex].f : false,
                'p': (settings.enableFilename) ? false : settings.currentPageIndex + 1,
                'y': (settings.inGrid) ? false : getYOffset(),
                'x': (settings.inGrid) ? false : getXOffset(),
                //'gy': (settings.inGrid) ? $(settings.outerSelector).scrollTop() : false,
                'h': (settings.inFullscreen) ? false: settings.panelHeight,
                'w': (settings.inFullscreen) ? false : $(settings.outerSelector).width()
            }

            return state;
        };

        var getURLHash = function () {
            var hashParams = getState();
            var hashStringBuilder = [];
            for (var param in hashParams) {
                if (hashParams[param] !== false) {
                    hashStringBuilder.push(param + settings.hashParamSuffix + '=' + hashParams[param]);
                }
            }
            return hashStringBuilder.join('&');
        };

        // Returns the URL to the current state of the document viewer (so it should be an exact replica)
        var getCurrentURL = function () {
            return location.protocol + '//' + location.host + location.pathname + '#' + getURLHash();
        };



        // Called in init and when the orientation changes
        var adjustMobileSafariDims = function () {
            var outerOffset = $(settings.outerSelector).offset().top;
            settings.panelHeight = window.innerHeight - outerOffset - 15;
            settings.panelWidth = window.innerWidth - 30;

            $(settings.parentSelector).width(settings.panelWidth);
            $(settings.outerSelector).width(settings.panelWidth).height(settings.panelHeight);
        };

        var resizeViewer = function (newWidth, newHeight) {
            if (newWidth >= settings.minWidth && newHeight >= settings.minHeight) {
                var oldWidth = settings.panelWidth;
                $(settings.outerSelector).width(newWidth);
                $(settings.outerSelector).height(newHeight);

                // Save the new height and width
                settings.panelHeight = newHeight;
                settings.panelWidth = newWidth - settings.scrollbarWidth;

                // Should also change the width of the container
                $(settings.parentSelector).width(newWidth); // including the scrollbar etc
            }
        };



        // Binds most of the event handlers (some more in createToolbar)
        var handleEvents = function () {
            // Create the fullscreen toggle icon if fullscreen is enabled
            if (settings.enableFullscreen) {
                // Event handler for fullscreen toggling
                $(settings.selector + 'fullscreen').click(function () {
                    toggleFullscreenIcon();
                });
            }

            // Change the cursor for dragging
            $(settings.innerSelector).mouseover(function () {
                $(this).removeClass('diva-grabbing').addClass('diva-grab');
            });

            $(settings.innerSelector).mouseout(function () {
                $(this).removeClass('diva-grab');
            });

            $(settings.innerSelector).mousedown(function () {
                $(this).removeClass('diva-grab').addClass('diva-grabbing');
            });

            $(settings.innerSelector).mouseup(function () {
                $(this).removeClass('diva-grabbing').addClass('diva-grab');
            });

            // Set drag scroll on first descendant of class dragger on both selected elements
            $(settings.outerSelector + ', ' + settings.innerSelector).dragscrollable({dragSelector: '.diva-dragger', acceptPropagatedEvent: true});

            // Handle the scroll
            $(settings.outerSelector).scroll(function () {
                // Has to be within this otherwise settings.inGrid is checked ONCE
                if (settings.inGrid) {
                    handleGridScroll();
                } else {
                    handleDocumentScroll();
                    settings.leftScrollSoFar = $(this).scrollLeft();
                }
            });

            // Double-click to zoom
            $(settings.outerSelector).on('dblclick', '.diva-document-page', function (event) {
                handleDocumentDoubleClick.call(this, event);
            });

            // Handle the control key for macs (in conjunction with double-clicking)
            $(settings.outerSelector).on('contextmenu', '.diva-document-page', function (event) {
                if (event.ctrlKey) {
                    return false;
                }
            });

            $(settings.outerSelector).on('dblclick', '.diva-row', function (event) {
                handleGridDoubleClick.call(this, event);
            });

            // Check if the user is on a iPhone or iPod touch or iPad
            if (settings.mobileSafari) {
                // One-finger scroll within outerdrag
                $(settings.outerSelector).oneFingerScroll();

                // Prevent resizing (below from http://matt.might.net/articles/how-to-native-iphone-ipad-apps-in-javascript/)
                var toAppend = [];
                toAppend.push('<meta name="viewport" content="user-scalable=no, width=device-width, initial-scale=1, maximum-scale=1" />');

                // Eliminate URL and button bars if added to home screen
                toAppend.push('<meta name="apple-mobile-web-app-capable" content="yes" />');

                // Choose how to handle the phone status bar
                toAppend.push('<meta name="apple-mobile-web-app-status-bar-style" content="black" />');
                $('head').append(toAppend.join('\n'));

                // Block the user from moving the window
                $('body').bind('touchmove', function (event) {
                    var e = event.originalEvent;
                    e.preventDefault();
                    return false;
                });

                // Allow pinch-zooming
                $('body').bind('gestureend', function (event) {
                    var e = event.originalEvent;
                    if (!settings.scaleWait) {
                        // Save the page we're currently on so we scroll there
                        settings.goDirectlyTo = settings.currentPageIndex;
                        if (settings.inGrid) {
                            settings.inGrid = false;

                            handleViewChange();
                        } else {
                            handlePinchZoom(e);
                        }
                    }
                    return false;
                });

                // Listen to orientation change event
                $('body').bind('orientationchange', function (event) {
                    settings.orientationChange = true;
                    adjustMobileSafariDims();

                    // Reload the viewer to account for the resized viewport
                    loadViewer();
                });
            }

            // Only check if either scrollBySpace or scrollByKeys is enabled
            if (settings.enableSpaceScroll || settings.enableKeyScroll) {
                var spaceKey = $.ui.keyCode.SPACE;
                var pageUpKey = $.ui.keyCode.PAGE_UP;
                var pageDownKey = $.ui.keyCode.PAGE_DOWN;
                var homeKey = $.ui.keyCode.HOME;
                var endKey = $.ui.keyCode.END;

                // Catch the key presses in document
                $(document).keydown(function (event) {
                    // Space or page down - go to the next page
                    if ((settings.enableSpaceScroll && event.keyCode == spaceKey) || (settings.enableKeyScroll && event.keyCode == pageDownKey)) {
                        $(settings.outerSelector).scrollTop(settings.scrollSoFar + settings.panelHeight);
                        return false;
                    }

                    // Page up - go to the previous page
                    if (settings.enableKeyScroll && event.keyCode == pageUpKey) {
                        $(settings.outerSelector).scrollTop(settings.scrollSoFar - settings.panelHeight);
                        return false;
                    }

                    // Home key - go to the beginning of the document
                    if (settings.enableKeyScroll && event.keyCode == homeKey) {
                        $(settings.outerSelector).scrollTop(0);
                        return false;
                    }

                    // End key - go to the end of the document
                    if (settings.enableKeyScroll && event.keyCode == endKey) {
                        $(settings.outerSelector).scrollTop(settings.totalHeight);
                        return false;
                    }
                });
            }
        };

        // Handles all status updating etc (both fullscreen and not)
        var createToolbar = function () {
            var gridIconHTML = (settings.enableGrid) ? '<div class="diva-grid-icon' + (settings.inGrid ? ' diva-in-grid' : '') + '" id="' + settings.ID + 'grid-icon" title="Toggle grid view"></div>' : '';
            var linkIconHTML = (settings.enableLink) ? '<div class="diva-link-icon" id="' + settings.ID + 'link-icon" style="' + (settings.enableGrid ? 'border-left: 0px' : '') + '" title="Link to this page"></div>' : '';
            var zoomSliderHTML = (settings.enableZoomSlider) ? '<div id="' + settings.ID + 'zoom-slider"></div>' : '';
            var gridSliderHTML = (settings.enableGridSlider) ? '<div id="' + settings.ID + 'grid-slider"></div>' : '';
            var gotoPageHTML = (settings.enableGotoPage) ? '<form id="' + settings.ID + 'goto-page" class="diva-goto-form"><input type="text" id="' + settings.ID + 'goto-page-input" / class="diva-input"> <input type="submit" value="Go to page" style="margin-top: 0px;" /></form>' : '';
            var zoomSliderLabelHTML = (settings.enableZoomSlider) ? '<div id="' + settings.ID + 'zoom-slider-label" class="diva-slider-label">Zoom level: <span id="' + settings.ID + 'zoom-level">' + settings.zoomLevel + '</span></div>' : '';
            var gridSliderLabelHTML = (settings.enableGridSlider) ? '<div id="' + settings.ID + 'grid-slider-label" class="diva-slider-label">Pages per row: <span id="' + settings.ID + 'pages-per-row">' + settings.pagesPerRow + '</span></div>' : '';
            var pageNumberHTML = '<div class="diva-page-label">Page <span id="' + settings.ID + 'current-page">1</span> of <span id="' + settings.ID + 'num-pages">' + settings.numPages + '</span></div>';

            // If the viewer is specified to be "contained", we make room for the fullscreen icon
            var otherToolbarClass = '';
            if (settings.contained) {
                // Make sure the container element does not have a static position
                // (Needed for the fullscreen icon to be contained)
                if ($(settings.parentSelector).css('position') === 'static') {
                    $(settings.parentSelector).addClass('diva-relative-position');
                }
                otherToolbarClass = ' diva-fullscreen-space';
                // If enableAutoTitle is set to TRUE, move it down
                if (settings.enableAutoTitle) {
                    $(settings.selector + 'fullscreen').addClass('diva-contained');
                }
            }
            var toolbarHTML = '<div id="' + settings.ID + 'tools-left" class="diva-tools-left' + otherToolbarClass + '">' + zoomSliderHTML + gridSliderHTML + zoomSliderLabelHTML + gridSliderLabelHTML + '</div><div id="' + settings.ID + 'tools-right" class="diva-tools-right">' + linkIconHTML + gridIconHTML + '<div class="diva-page-nav">' + gotoPageHTML + pageNumberHTML + '</div></div>';

            $(settings.parentSelector).prepend('<div id="' + settings.ID + 'tools" class="diva-tools">' + toolbarHTML + '</div>');

            // Attach handlers to everything
            $(settings.selector + 'zoom-slider').slider({
                value: settings.zoomLevel,
                min: settings.minZoomLevel,
                max: settings.maxZoomLevel,
                step: 1,
                slide: function (event, ui) {
                    var i = settings.currentPageIndex;
                    settings.goDirectlyTo = i;

                    // Figure out the horizontal and vertical offsets
                    // (Try to zoom in on the current center)
                    var zoomRatio = Math.pow(2, ui.value - settings.zoomLevel);
                    var innerWidth = settings.maxWidths[settings.zoomLevel] + settings.horizontalPadding * 2;
                    var centerX = $(settings.outerSelector).scrollLeft() - (innerWidth - settings.panelWidth) / 2;
                    settings.horizontalOffset = (innerWidth > settings.panelWidth) ? centerX * zoomRatio : 0;
                    settings.verticalOffset = zoomRatio * ($(settings.outerSelector).scrollTop() - settings.heightAbovePages[i]);
                    handleZoom(ui.value);
                },
                change: function (event, ui) {
                    if (ui.value !== settings.zoomLevel) {
                        handleZoom(ui.value);
                    }
                }
            });

            $(settings.selector + 'grid-slider').slider({
                value: settings.pagesPerRow,
                min: settings.minPagesPerRow,
                max: settings.maxPagesPerRow,
                step: 1,
                slide: function (event, ui) {
                    handleGrid(ui.value);
                },
                change: function (event, ui) {
                    if (ui.value !== settings.pagesPerRow) {
                        handleGrid(ui.value);
                    }
                }
            });

            $(settings.selector + 'grid-icon').click(function () {
                toggleGridIcon();
            });

            $(settings.selector + 'goto-page').submit(function () {
                var desiredPage = parseInt($(settings.selector + 'goto-page-input').val(), 10);
                var pageIndex = desiredPage - 1;

                if (!isPageValid(pageIndex)) {
                    alert("Invalid page number");
                } else {
                    if (settings.inGrid) {
                        gotoRow(pageIndex);
                    } else {
                        gotoPage(pageIndex, 0, 0);
                    }
                }

                // Prevent the default action of reloading the page
                return false;
            });

            // Handle the creation of the link popup box
            $(settings.selector + 'link-icon').click(function () {
                var leftOffset = $(settings.outerSelector).offset().left + settings.panelWidth;
                $('body').prepend('<div id="' + settings.ID + 'link-popup" class="diva-link-popup"><input id="' + settings.ID + 'link-popup-input" class="diva-input" type="text" value="'+ getCurrentURL() + '"/></div>');
                if (settings.inFullscreen) {
                    $(settings.selector + 'link-popup').css('top', '150px').css('right', '30px');
                } else {
                    $(settings.selector + 'link-popup').css('top', $(settings.outerSelector).offset().top + 'px').css('left', (leftOffset - 223) + 'px');
                }

                // Catch onmouseup events outside of this div
                $('body').mouseup(function (event) {
                    var targetID = event.target.id;
                    if (targetID == settings.ID + 'link-popup' || targetID == settings.ID + 'link-popup-input') {
                    } else {
                        $(settings.selector + 'link-popup').remove();
                    }
                });
                // Also delete it upon scroll and page up/down key events
                $(settings.outerSelector).scroll(function () {
                    $(settings.selector + 'link-popup').remove();
                });
                $(settings.selector + 'link-popup input').click(function () {
                    $(this).focus().select();
                });
                return false;
            });

            // Show the relevant slider
            var currentSlider = (settings.inGrid) ? 'grid' : 'zoom';
            $(settings.selector + currentSlider + '-slider').show();
            $(settings.selector + currentSlider + '-slider-label').show();

            var switchMode = function () {
                // Switch from fullscreen to not, etc
                $(settings.selector + 'tools').toggleClass('diva-fullscreen-tools');
                if (!settings.inFullscreen) {
                    // Leaving fullscreen
                    $(settings.selector + 'tools-left').after($(settings.selector + 'tools-right'));
                    $(settings.selector + 'tools-left').css('float', 'left').css('padding-top', '0px').css('text-align', 'left').css('clear', 'none');
                } else {
                    // Entering fullscreen
                    $(settings.selector + 'tools-right').after($(settings.selector + 'tools-left'));
                    $(settings.selector + 'tools-left').css('float', 'right').css('padding-top', '10px').css('text-align', 'right').css('clear', 'both');
                }
            }

            var switchSlider = function () {
                // Switch from grid to document view etc
                $(settings.selector + currentSlider + '-slider').hide();
                $(settings.selector + currentSlider + '-slider-label').hide();
                currentSlider = (settings.inGrid) ? 'grid' : 'zoom';
                $(settings.selector + currentSlider + '-slider').show();
                $(settings.selector + currentSlider + '-slider-label').show();

                // Also change the image for the grid icon
                $(settings.selector + 'grid-icon').toggleClass('diva-in-grid');
            };

            if (settings.jumpIntoFullscreen) {
                switchMode();
            }

            var toolbar = {
                updateCurrentPage: function () {
                    $(settings.selector + 'current-page').text(settings.currentPageIndex + 1);
                },
                setNumPages: function (newNumber) {
                    $(settings.selector + 'num-pages').text(newNumber);
                },
                updateZoomSlider: function () {
                    if (settings.zoomLevel !== $(settings.selector + 'zoom-slider').slider('value')) {
                        $(settings.selector + 'zoom-slider').slider({
                            value: settings.zoomLevel
                        });
                    }

                    $(settings.selector + 'zoom-level').text(settings.zoomLevel);
                },
                updateGridSlider: function () {
                    if (settings.pagesPerRow !== $(settings.selector + 'grid-slider').slider('value')) {
                        $(settings.selector + 'grid-slider').slider({
                            value: settings.pagesPerRow
                        });
                    }

                    $(settings.selector + 'pages-per-row').text(settings.pagesPerRow);
                },
                switchSlider: switchSlider,
                switchMode: switchMode
            }
            return toolbar;
        };

        var initPlugins = function () {
            if (window.divaPlugins) {
                var pageTools = ['<div class="diva-page-tools">'];

                // Add all the plugins that have not been explicitly disabled to settings.plugins
                $.each(window.divaPlugins, function (index, plugin) {
                    var pluginProperName = plugin.pluginName[0].toUpperCase() + plugin.pluginName.substring(1)
                    if (!settings['disable' + pluginProperName]) {
                        // Set all the settings
                        executeCallback(plugin.init, settings);

                        // If the title text is undefined, use the name of the plugin
                        var titleText = plugin.titleText || pluginProperName + " plugin";

                        // Create the pageTools bar
                        pageTools.push('<div class="diva-' + plugin.pluginName + '-icon" title="' + titleText + '"></div>');

                        // Delegate the click event - pass it the settings
                        $(settings.outerSelector).delegate('.diva-' + plugin.pluginName + '-icon', 'click', function (event) {
                            plugin.handleClick.call(this, event, settings);
                        });


                        // Add it to settings.plugins so it can be used later
                        settings.plugins.push(plugin);
                    }
                });

                // Save the page tools bar so it can be added for each page
                pageTools.push('</div>');
                settings.pageTools = pageTools.join('');
            }
        };

        var setupViewer = function () {
            $.ajax({
                url: settings.divaserveURL,
                data: {
                    d: settings.imageDir
                },
                cache: true,
                dataType: 'json',
                error: function (data) {
                    // Show a basic error message within the document viewer pane
                    $(settings.outerSelector).text("Invalid URL. Error code: " + data.status);
                },
                success: function (data) {
                    // Save all the data we need
                    settings.pages = data.pgs;
                    settings.maxRatio = data.dims.max_ratio;
                    settings.minRatio = data.dims.min_ratio;
                    settings.itemTitle = data.item_title;
                    settings.numPages = data.pgs.length;

                    // These are arrays, the index corresponding to the zoom level
                    settings.maxWidths = data.dims.max_w;
                    settings.maxHeights = data.dims.max_h;
                    settings.averageWidths = data.dims.a_wid;
                    settings.averageHeights = data.dims.a_hei;
                    settings.totalHeights = data.dims.t_hei;
                    settings.totalWidths = data.dims.t_wid;

                    // Make sure the set max and min values are valid
                    settings.realMaxZoom = data.max_zoom;
                    settings.maxZoomLevel = (settings.maxZoomLevel >= 0 && settings.maxZoomLevel <= data.max_zoom) ? settings.maxZoomLevel : data.max_zoom;
                    settings.minZoomLevel = (settings.minZoomLevel >= 0 && settings.minZoomLevel <= settings.maxZoomLevel) ? settings.minZoomLevel : 0;
                    settings.minPagesPerRow = Math.max(2, settings.minPagesPerRow);
                    settings.maxPagesPerRow = Math.max(settings.minPagesPerRow, settings.maxPagesPerRow);

                    // Check that the desired page is in range
                    if (settings.enableFilename) {
                        var iParam = $.getHashParam('i' + settings.hashParamSuffix);
                        var iParamPage = getPageIndex(iParam);
                        if (isPageValid(iParamPage)) {
                            settings.goDirectlyTo = iParamPage;
                        }
                    } else {
                        // Not using the i parameter, check the p parameter
                        // Subtract 1 to get the page index
                        var pParam = parseInt($.getHashParam('p' + settings.hashParamSuffix), 10) - 1;
                        if (isPageValid(pParam)) {
                            settings.goDirectlyTo = pParam;
                        }
                    }

                    // Execute the setup hook for each plugin (if defined)
                    $.each(settings.plugins, function (index, plugin) {
                        executeCallback(plugin.setupHook, settings);
                    });

                    // Create the toolbar and display the title + total number of pages
                    settings.toolbar = createToolbar();
                    $(settings.selector + 'current label').text(settings.numPages);
                    if (settings.enableAutoTitle) {
                        $(settings.parentSelector).prepend('<div id="' + settings.ID + 'title" class="diva-title">' + settings.itemTitle + '</div>');
                    }

                    // Adjust the document panel dimensions for Apple touch devices
                    if (settings.mobileSafari) {
                        adjustMobileSafariDims();
                    } else {
                        // For other devices, adjust to take the scrollbar into account
                        settings.panelWidth = parseInt($(settings.parentSelector).width(), 10) - 18;
                        $(settings.outerSelector).css('width', (settings.panelWidth + 18) + 'px');
                        settings.panelHeight = parseInt($(settings.outerSelector).height(), 10);
                    }

                    // Calculate the viewer x and y offsets
                    var viewerOffset = $(settings.outerSelector).offset();
                    settings.viewerXOffset = viewerOffset.left;
                    settings.viewerYOffset = viewerOffset.top;

                    if (settings.inFullscreen) {
                        handleModeChange();
                    } else {
                        loadViewer();
                    }

                    // Execute the callback
                    executeCallback(settings.onReady, settings);
                }
            });
        };

        var init = function () {
            // First figure out the width of the scrollbar in this browser
            settings.scrollbarWidth = $.getScrollbarWidth();
            // Check if the platform is the iPad/iPhone/iPod
            settings.mobileSafari = navigator.platform == 'iPad' || navigator.platform == 'iPhone' || navigator.platform == 'iPod';

            // Generate an ID that can be used as a prefix for all the other IDs
            settings.ID = $.generateId('diva-');
            settings.selector = '#' + settings.ID;

            // Figure out the hashParamSuffix from the ID
            var divaNumber = parseInt(settings.ID, 10);
            if (divaNumber > 1) {
                // If this is document viewer #1, don't use a suffix; otherwise, use the document viewer number
                settings.hashParamSuffix = divaNumber;
            }

            // Since we need to reference these two a lot
            settings.outerSelector = settings.selector + 'outer';
            settings.innerSelector = settings.selector + 'inner';

            // Create the inner and outer panels
            $(settings.parentSelector).append('<div id="' + settings.ID + 'outer" class="diva-outer"></div>');
            $(settings.outerSelector).append('<div id="' + settings.ID + 'inner" class="diva-inner diva-dragger"></div>');

            // Create the fullscreen icon
            if (settings.enableFullscreen) {
                $(settings.parentSelector).prepend('<div id="' + settings.ID + 'fullscreen" class="diva-fullscreen-icon" title="Toggle fullscreen mode"></div>');
            }

            // First, n - check if it's in range
            var nParam = parseInt($.getHashParam('n' + settings.hashParamSuffix), 10);
            if (nParam >= settings.minPagesPerRow && nParam <= settings.maxPagesPerRow) {
                settings.pagesPerRow = nParam;
            }

            // Now z - check that it's in range
            var zParam = $.getHashParam('z' + settings.hashParamSuffix);
            if (zParam !== '') {
                // If it's empty, we don't want to change the default zoom level
                zParam = parseInt(zParam, 10);
                // Can't check if it exceeds the max zoom level or not because that data is not available yet ...
                if (zParam >= settings.minZoomLevel) {
                    settings.zoomLevel = zParam;
                }
            }

            // y - vertical offset from the top of the relevant page
            var yParam = parseInt($.getHashParam('y' + settings.hashParamSuffix), 10);
            if (!isNaN(yParam)) {
                settings.verticalOffset = yParam;
            }

            // x - horizontal offset from the center of the page
            var xParam = parseInt($.getHashParam('x' + settings.hashParamSuffix), 10);
            if (!isNaN(xParam)) {
                settings.horizontalOffset = xParam;
            }

            // If the "fullscreen" hash param is true, go to fullscreen initially
            // If the grid hash param is true, go to grid view initially
            var gridParam = $.getHashParam('g' + settings.hashParamSuffix);
            var goIntoGrid = gridParam === 'true';
            var fullscreenParam = $.getHashParam('f' + settings.hashParamSuffix);
            var goIntoFullscreen = fullscreenParam === 'true';

            settings.inGrid = settings.inGrid && gridParam !== 'false' || goIntoGrid;
            settings.inFullscreen = settings.inFullscreen && fullscreenParam !== 'false' || goIntoFullscreen;

            // Store the height and width of the viewer (the outer div), if present
            var desiredHeight = parseInt($.getHashParam('h' + settings.hashParamSuffix), 10);
            var desiredWidth = parseInt($.getHashParam('w' + settings.hashParamSuffix), 10);

            // Store the minimum and maximum height too
            settings.minHeight = parseInt($(settings.outerSelector).css('min-height'));
            settings.minWidth = parseInt($(settings.outerSelector).css('min-width'));

            // Just call resize, it'll take care of bounds-checking etc
            if (desiredHeight > 0 || desiredWidth > 0) {
                resizeViewer(desiredWidth, desiredHeight);
            }

            // Do the initial AJAX request and viewer loading
            setupViewer();

            // Do all the plugin initialisation
            initPlugins();

            handleEvents();
        };


        // Call the init function when this object is created.
        init();

        /* PUBLIC FUNCTIONS
        ===============================================
        */

        // Returns the title of the document, based on the directory name
        this.getItemTitle = function () {
            return settings.itemTitle;
        };

        // Go to a particular page (with indexing starting at 1)
        this.gotoPage = function (pageNumber) {
            var pageIndex = pageNumber - 1;
            if (isPageValid(pageIndex)) {
                gotoPage(pageIndex);
            }
        };

        // Returns the page index (with indexing starting at 0)
        this.getCurrentPage = function () {
            return settings.currentPageIndex;
        };

        // Returns the current zoom level
        this.getZoomLevel = function () {
            return settings.zoomLevel;
        };

        this.setZoomLevel = function (zoomLevel) {
            return handleZoom(zoomLevel);
        };

        // Zoom in, with callback. Will return false if it's at the maximum zoom
        this.zoomIn = function () {
            return this.setZoomLevel(settings.zoomLevel + 1);
        };

        // Zoom out, with callback. Will return false if it's at the minimum zoom
        this.zoomOut = function () {
            return this.setZoomLevel(settings.zoomLevel - 1);
        };

        // Uses the verticallyInViewport() function, but relative to a page
        // Check if something (e.g. a highlight box on a particular page) is visible
        this.inViewport = function (pageNumber, topOffset, height) {
            var pageIndex = pageNumber - 1;
            var top = settings.heightAbovePages[pageIndex] + topOffset;
            var bottom = top + height;
            return verticallyInViewport(top, bottom);
        };

        this.toggleMode = function () {
            toggleFullscreenIcon();
        };

        // This function will work even if enableFullscreen is set to false
        this.enterFullscreen = function () {
            if (!settings.inFullscreen) {
                toggleFullscreenIcon();
                return true;
            } else {
                // We're already in fullscreen, return false
                return false;
            }
        };

        this.leaveFullscreen = function () {
            if (settings.inFullscreen) {
                toggleFullscreenIcon();
                return true;
            } else {
                // We're not in fullscreen, return false
                return false;
            }
        };

        this.toggleView = function () {
            toggleGridIcon();
        };

        this.enterGrid = function () {
            if (!settings.inGrid) {
                toggleGridIcon();
                return true;
            } else {
                return false;
            }
        };

        this.leaveGrid = function () {
            if (settings.inGrid) {
                toggleGridIcon();
                return true;
            } else {
                return false;
            }
        };

        // Jump to an image based on its filename
        this.gotoPageByName = function (filename) {
            // Go through all the pages looking for one whose filename matches
            for (var i = 0; i < settings.numPages; i++) {
                if (settings.pages[i].f == filename) {
                    gotoPage(i);
                    return true;
                }
            }

            // If not found, return false
            return false;
        };

        // Get the current URL (exposes the private method)
        this.getCurrentURL = function () {
            return getCurrentURL();
        };

        // Get the hash part only of the current URL (without the leading #)
        this.getURLHash = function () {
            return getURLHash();
        };

        this.getState = function () {
            return getState();
        };

        /*
        // Temporarily commented out (needs rewrite)
        this.setState = function (state) {
            // Ignore fullscreen, this is meant for syncing two viewers ... they can't both be fullscreen
            // Pass it the state retrieved from calling getState() on another diva
            settings.gridScrollTop = state.gy;
            settings.goDirectlyTo = (isNaN(state.i)) ? getPageIndex(state.i) : state.i; // if not a number, it's a filename
            settings.desiredXOffset = state.x;
            settings.desiredYOffset = state.y;

            // The actions to take depend on both the desired state and the current state
            if (state.g) {
                // Save the zoom level (won't be used right away, but it must be done here)
                settings.zoomLevel = state.z
                // Are we already in grid mode?
                if (settings.inGrid) {
                    // Do we need to change the number of pages per row?
                    if (settings.pagesPerRow === state.n) {
                        // We don't ... now do gridScroll() just in case we need to scroll
                        gridScroll();
                    } else {
                        // We do ... change that, scrolling will be taken care of automatically
                        handleGridSlide(state.n);
                    }
                } else {
                    // Enter the grid ... scrolling and pages per row should be done automatically
                    settings.pagesPerRow = state.n;
                    // Can't call enter grid because it overwrites the desired x and y offsets
                    settings.inGrid = true;
                    loadGrid(settings.pagesPerRow);
                }
            } else {
                // Save the number of pages per row here in case we go into grid mode later
                settings.pagesPerRow = state.n;
                // Are we in grid mode right now?
                if (settings.inGrid) {
                    // We are ... let's get out of it
                    settings.zoomLevel = state.z;
                    leaveGrid();
                } else {
                    // Do we need to change the zoom level?
                    if (settings.zoomLevel === state.z) {
                        // Nope. Just scroll.
                        documentScroll();
                    } else {
                        // We do, do it
                        handleZoom(state.z);
                    }
                }
            }

            // If we need to resize, do it now
            if (settings.panelHeight !== state.h || (settings.panelWidth + settings.scrollbarWidth) !== state.w) {
                resizeViewer(state.h, state.w);
                // Reload it
                loadViewer();
            }
        };
        */

        // Resizes the outer div to the specified width and height
        this.resize = function (newWidth, newHeight) {
            resizeViewer(newWidth, newHeight);
            loadViewer();
        };

        // Destroys this instance, tells plugins to do the same
        this.destroy = function () {
            // Removes the hide-scrollbar class from the body
            $('body').removeClass('diva-hide-scrollbar');
            $(settings.parentSelector).empty().removeData('diva');
            $.each(settings.plugins, function (index, plugin) {
                executeCallback(plugin.destroy);
            });

            // Remove any additional styling on the parent element
            $(settings.parentSelector).removeAttr('style').removeAttr('class');
        };
    };



    $.fn.diva = function (options) {
        return this.each(function () {
            var element = $(this);

            // Return early if this element already has a plugin instance
            if (element.data('diva')) {
                return;
            }
            options.parentSelector = element;

            // Otherwise, instantiate the document viewer
            var diva = new Diva(this, options);
            element.data('diva', diva);
            options.diva = diva;
        });
    };

})(jQuery);
