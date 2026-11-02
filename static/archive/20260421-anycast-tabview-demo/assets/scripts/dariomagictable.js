
var dataView;
var grid;
var data = [];

/*  old dario code for dblp2js

var columns = [
{id: "id",    name: "Key", field: "id", behavior: "select", cssClass: "cell-selection", width: 40, cannotTriggerInsert: true, resizable: false, selectable: false },
{id: "title", name: "Title", field: "title", width: 120, minWidth: 220, cssClass: "cell-title", cannotTriggerInsert: true, sortable: true,
	formatter: linkFormatter = function ( row, cell, value, columnDef, dataContext ) {
            return '<a target="_blank" href="' + dataContext['url'] + '"> ' + value + '</a>';
        }
},
{id: "venue",  name: "Venue",   field: "venue",                   cannotTriggerInsert: true, sortable: true},
{id: "author", name: "Authors", field: "author",  width: 80, resizable: true, cannotTriggerInsert: true, sortable: true},
{id: "year",   name: "Year",    field: "year",               resizable: true, cannotTriggerInsert: true, sortable: true, maxWidth: 60},
];

// {id: "url", name: "URL", field: "url", resizable: true, cannotTriggerInsert: true, sortable: true, 
//  formatter: linkFormatter = function ( row, cell, value, columnDef, dataContext ) {
//             return '<a href="' + dataContext['url'] + '">' + value + '</a>';
//         }},

//{id: "title", name: "Title", field: "title", width: 120, minWidth: 220, cssClass: "cell-title", cannotTriggerInsert: true, sortable: true,
//  formatter: linkFormatter = function ( row, cell, value, columnDef, dataContext ) {
//            return '<a target="_blank" href="' + dataContext['url'] + '"> ' + value + '</a>';
//        }
//},

*/

function NumericSorter(a, b) {
  var x = a[sortcol], y = b[sortcol];
  return sortdir * (x == y ? 0 : (x > y ? 1 : -1));
}

//  loaded directly from JS 
var columns; 
// loaded directly from JS 

var options = {
	editable: false,
	enableAddRow: false,
	enableCellNavigation: true,
	forceFitColumns: true,
	topPanelHeight: 25
};
var sortcol = "#IP";
var sortdir = 1;
var minFootprint = 5;
var searchString = "";

function requiredFieldValidator(value) {
	if (value == null || value == undefined || !value.length) {
	return {valid: false, msg: "This is a required field"};
	}
	else {
	return {valid: true, msg: null};
	}
}
function myFilter(item, args) {
  var itemString = "";
  for (var key in item) {
    itemString += item[key]
  }

  if (args.searchString != "" &&  itemString.toUpperCase().indexOf(args.searchString.toUpperCase()) == -1) {
  	return false;
  }
    
  for (var key in item) {
    if( key.substr(0, 5) == "2016-") {
      //alert( item[key] );
      if (item[key] > args.minFootprint) {
          return true
      } 
    }
  }
       
  return false;
}


function percentCompleteSort(a, b) {
	return a["percentComplete"] - b["percentComplete"];
}
function comparer(a, b) {
	var x = a[sortcol], y = b[sortcol];
	return (x == y ? 0 : (x > y ? 1 : -1));
}
function toggleFilterRow() {
	grid.setTopPanelVisibility(!grid.getOptions().showTopPanel);
}
$(".grid-header .ui-icon")
	.addClass("ui-state-default ui-corner-all")
	.mouseover(function (e) {
		$(e.target).addClass("ui-state-hover")
	})
	.mouseout(function (e) {
		$(e.target).removeClass("ui-state-hover")
	});








$(function () {
  // prepare the data

  dataView = new Slick.Data.DataView({ inlineFilters: true });
  grid = new Slick.Grid("#myGrid", dataView, columns, options);
  grid.setSelectionModel(new Slick.RowSelectionModel());

  // for NumericSorter
  grid.onSort.subscribe(function(e, args) {
    sortdir = args.sortAsc ? 1 : -1;
    sortcol = args.sortCol.field;

    dataView.sort(args.sortCol.sorter, sortdir);
    args.grid.invalidateAllRows();
    args.grid.render();
  });
  // for NumericSorter


  var pager = new Slick.Controls.Pager(dataView, grid, $("#pager"));
  var columnpicker = new Slick.Controls.ColumnPicker(columns, grid, options);


  // move the filter panel defined in a hidden div into grid top panel
  $("#inlineFilterPanel")
      .appendTo(grid.getTopPanel())
      .show();

  grid.onCellChange.subscribe(function (e, args) {
    dataView.updateItem(args.item.id, args.item);
  });

  grid.onAddNewRow.subscribe(function (e, args) {
    var item = {"num": data.length, "id": "new_" + (Math.round(Math.random() * 10000)), "title": "New task", "duration": "1 day", "percentComplete": 0, "start": "01/01/2009", "finish": "01/01/2009", "effortDriven": false};
    $.extend(item, args.item);
    dataView.addItem(item);
  });

  grid.onKeyDown.subscribe(function (e) {
    // select all rows on ctrl-a
    if (e.which != 65 || !e.ctrlKey) {
      return false;
    }

    var rows = [];
    for (var i = 0; i < dataView.getLength(); i++) {
      rows.push(i);
    }

    grid.setSelectedRows(rows);
    e.preventDefault();
  });

  grid.onSort.subscribe(function (e, args) {
    sortdir = args.sortAsc ? 1 : -1;
    sortcol = args.sortCol.field;

    if ($.browser.msie && $.browser.version <= 8) {
      // using temporary Object.prototype.toString override
      // more limited and does lexicographic sort only by default, but can be much faster

      var percentCompleteValueFn = function () {
        var val = this["percentComplete"];
        if (val < 10) {
          return "00" + val;
        } else if (val < 100) {
          return "0" + val;
        } else {
          return val;
        }
      };

      // use numeric sort of % and lexicographic for everything else
      dataView.fastSort((sortcol == "percentComplete") ? percentCompleteValueFn : sortcol, args.sortAsc);
    } else {
      // using native sort with comparer
      // preferred method but can be very slow in IE with huge datasets
      dataView.sort(comparer, args.sortAsc);
    }
  });

  // wire up model events to drive the grid
  dataView.onRowCountChanged.subscribe(function (e, args) {
    grid.updateRowCount();
    grid.render();
  });

  dataView.onRowsChanged.subscribe(function (e, args) {
    grid.invalidateRows(args.rows);
    grid.render();
  });

  dataView.onPagingInfoChanged.subscribe(function (e, pagingInfo) {
    var isLastPage = pagingInfo.pageNum == pagingInfo.totalPages - 1;
    var enableAddRow = isLastPage || pagingInfo.pageSize == 0;
    var options = grid.getOptions();

    if (options.enableAddRow != enableAddRow) {
      grid.setOptions({enableAddRow: enableAddRow});
    }
  });


  var h_runfilters = null;

/*
  // wire up the slider to apply the filter to the model
  $("#pcSlider,#pcSlider2").slider({
    "range": "min",
    "slide": function (event, ui) {
      Slick.GlobalEditorLock.cancelCurrentEdit();
      $("#label").css("left", "-50px");
      if (minFootprint != ui.value) {
        window.clearTimeout(h_runfilters);
        h_runfilters = window.setTimeout(updateFilter, 10);
        minFootprint = ui.value;
      }
    }
  });
  */

   var initialValue=5, min=0, max=15;
   $("#pcSlider,#pcSlider2").slider({
      value:initialValue,
      min: min,
      max: max,
      step: 1,
      slide: function( event, ui ) {
          $("#days").val( ui.value );
          $("#label").text(ui.value);
          $("#label").css("margin-left", (ui.value-min)/(max-min)*100+"%");
          $("#label").css("left", "-50px");
          if (minFootprint != ui.value) {
              window.clearTimeout(h_runfilters);
              h_runfilters = window.setTimeout(updateFilter, 10);
              minFootprint = ui.value;
          }

      }
  });
  $("#days").val(initialValue);
  $("#label").text(initialValue);
  $("#label").css("margin-left", (initialValue -1)/(max-min)*100+"%");
  $("#label").css("left", "-50px");



  // wire up the search textbox to apply the filter to the model
  $("#txtSearch,#txtSearch2").keyup(function (e) {
    Slick.GlobalEditorLock.cancelCurrentEdit();

    // clear on Esc
    if (e.which == 27) {
      this.value = "";
    }

    searchString = this.value;
    updateFilter();
  });

  function updateFilter() {
    dataView.setFilterArgs({
      minFootprint: minFootprint,
      searchString: searchString
    });
    dataView.refresh();
  }

  $("#btnSelectRows").click(function () {
    if (!Slick.GlobalEditorLock.commitCurrentEdit()) {
      return;
    }

    var rows = [];
    for (var i = 0; i < 10 && i < dataView.getLength(); i++) {
      rows.push(i);
    }

    grid.setSelectedRows(rows);
  });


  // initialize the model after all the events have been hooked up
  dataView.beginUpdate();
  grid.setTopPanelVisibility(1);
  dataView.setItems(data);
  dataView.setFilterArgs({
    minFootprint: minFootprint,
    searchString: searchString
  });
  dataView.setFilter(myFilter);
  dataView.endUpdate();

  // if you don't want the items that are not visible (due to being filtered out
  // or being on a different page) to stay selected, pass 'false' to the second arg
  dataView.syncGridSelection(grid, true);

  $("#gridContainer").resizable();
})
