/* Ejemplo de respuesta aceptada.
{
"axis_y_current_page":1,
"axis_y_page_step":1,
"axis_y_total_page_count":35,
"axis_x_previous_page":1513468800000,
"axis_x_current_page":1521936000000,
"axis_x_next_page":1530403200000,
"axis_x_timeframe":1,
"axis_x_labels":{"nombre":"Nombre recurso",
"tipo":"Tipo recurso",
"rol":"Rol recurso"},
"axis_y_items":[
	{
		"id":1,
		"timestamp":1521936000000,
		"content":{"value":"32.00", "css": "red"},
		"can_edit":true
	},
	{
		"id":1,
		"timestamp":1522540800000,
		"content":{"value":"32.00"},
		"can_edit":true
	},
	{
		"id":1,
		"timestamp":1523145600000,
		"content":{"value":"32.00"},
		"can_edit":true
	}
],
"axis_y_items_ref":[
	{
		"id":1,
		"nombre":"Rodrigo Aceituno "
	},
	{
		"id":3,
		"nombre":"Viviana Acosta "
	},
	{
		"id":4,
		"nombre":"Andres Aguila "
	}
]}
 */

(function($){

    /** @var array data.axis_y_items */
    /** @var array data.axis_y_items_ref */
    /** @var int data.axis_x_timeframe */
    /** @var int data.axis_x_current_page */
    /** @var int data.axis_x_next_page */
    /** @var int data.axis_y_total_page_count */
    /** @var int data.axis_y_current_page */

    jQuery.AllAxisTableJS = {
        form: null,
        container: null,
        timestamp: null,
		timeframe: null,
        page: null,
        data: null,
		form_data: null,
		form_data_history: [],
        loading: null,
        opts: null,
		time_nav: 0, // -1 hacia el pasado, +1 hacia el futuro
		pixels_to_load: null, // A cuantos pixeles antes de no tener mas data cargamo la pagina pasada o futura
        pixels_to_scroll: null,
		x_axis_scroll_item_count: 4,
		scroll_speed: 500,
        rendered: false,
        init: function(opts){
			
			/** for logs only **/
			this.id = jQuery.AllAxisTableJS.getID();
			/*******************/
			
            this.opts = opts || {};

            this.form = $(this.opts.formSelector)
            if (!this.form.length && !this.opts.data) throw new Error('Form is not found!');

            this.container = opts.container;
            if (!this.container.length) throw new Error('Container is not found!');

            this.container.addClass('table-js-container');

            this.createLoadingFrame();
            this.setEvents();
        },
        createLoadingFrame: function(){
			
			this.loading = $('#loading');
			
			// Si ya existe una ventana de loading, no la creamos nuevamente
			if (this.loading.length)
				return;
			
            this.loading = $('<div id="loading"></div>');
            if (this.opts.loadingImageSrc){
                this.loading.append($('<img src="' + this.opts.loadingImageSrc + '" width="' + (this.opts.loadingImageWidth || 'auto') + '"/>'));
            }else{
                this.loading.append($('<span>Loading...</span>'));
            }
            this.loading.appendTo(document.body);
        },
        createNavBar: function(){

            this.btn_to_top = $('<a href="#" class="btn btn-dark btn-sm page-up">&#9650; P&aacute;gina Anterior</a>');
            this.btn_to_top.on('click', {page: -1, htmlclass: ''}, $.proxy(this.prepareSubmit, this));

            this.btn_to_bottom = $('<a href="#" class="btn btn-dark btn-sm page-down">P&aacute;gina Siguiente &#9660;</a>');
            this.btn_to_bottom.on('click', {page: +1}, $.proxy(this.prepareSubmit, this));
			
            this.btn_to_left = $('<a href="#" class="btn btn-dark btn-sm page-left">&#8592; Pasado</a>');
            this.btn_to_left.on('click', {timestamp: -1}, $.proxy(this.prepareSubmit, this)).on('click', {c: 'page-left'}, $.proxy(this.syncNavClick, this));

            this.btn_to_right = $('<a href="#" class="btn btn-dark btn-sm page-right">Futuro &#8594;</a>');
            this.btn_to_right.on('click', {timestamp: +1}, $.proxy(this.prepareSubmit, this)).on('click', {c: 'page-right'}, $.proxy(this.syncNavClick, this));
			
			this.btn_goto_today = $('<a href="#" class="btn btn-dark btn-sm goto-today">Reposicionar</a>');
			this.btn_goto_today.on('click', $.proxy(this.goToInitDate, this)).on('click', {c: 'goto-today'}, $.proxy(this.syncNavClick, this));

            //var table_title = $('<div class="buttons pt-1 pb-1 text-center"><h2>Soy el titulo de la tabla</h2></div>');
            var info_page = $('<div class="lh-30 pt-1 pb-1 text-center page-info">Page: <span class="current-page"></span> de <span class="total-page"></span></div>');
            var buttons_page = $('<div class="buttons pt-1 pb-1 text-center page-nav"></div>').append(this.btn_to_top).append(this.btn_to_bottom);
			var buttons_time = $('<div class="buttons pt-1 pb-1 text-center time-nav"></div>').append(this.btn_to_left).append(this.btn_to_right);
			var goto_today = $('<div class="buttons pt-1 pb-1 text-center extra-controls"></div>').append(this.btn_goto_today);

            return $('<div class="table-navbar d-sm-flex justify-content-around"></div>')
                .append(info_page).append(buttons_page).append(buttons_time).append(goto_today);
        },
		goToInitDate: function(e){
			e.preventDefault();
			this.goToDate(new Date(this.form_data_history[0].timestamp));
		},
		goToDate: function(date){
			// solo funciona si la fecha esta cargada en el dom
			var el = this.container.find('tr:first-child td[data-timestamp="' + date.getTime() + '"]');
			
			if (!el.length) return;
			
			var container = this.container.find('.table-responsive');
			var scrollLeft = el.offset().left - this.getFixedColumnsWidth() - container.offset().left + container.scrollLeft();
			
			this.addAnimateScrollToQueue(scrollLeft);
		},
		syncNavClick: function(e, params){
			e.preventDefault(); // TODO ver con linea 288, hace un trigger clic a tomar en consideracion
			params = params || {};
			if (e.isTrigger && !params.forceSync) 	return;
			delete params.forceSync;
			for(var i = 0; i < this.opts.navSyncWith.length; i++){
				$(this.opts.navSyncWith[i]).find('.table-navbar a.' + e.data.c).trigger('click', params);
			}
		},
        addToNavSync: function(items){
            $(items).each(function(i, item){
                this.opts.navSyncWith.push(item);
            });
        },
		addAnimateScrollToQueue: function(scrollLeft){
			$.when(this.queue).done($.proxy(function(){
				//console.log('DEBUG: [ID='+this.obj.id+'] => ' + this.scrollLeft, this.obj.container.find('.table-responsive').scrollLeft());
				this.obj.queue = this.obj.container.find('.table-responsive').animate({scrollLeft: this.scrollLeft}, this.scrollSpeed).promise();
			}, {obj: this, scrollLeft: scrollLeft, scrollSpeed: this.scroll_speed}));
		},
        prepareSubmit: function(e, params){
            e.preventDefault();
			params = params || {};
			
			//console.log('[ID='+this.id+'] prepareSubmit');
			
			// actualizamos el pixel to scroll segun el ancho de la primera columna no fixed
			this.pixels_to_scroll = params.pixels_to_scroll ? params.pixels_to_scroll : (this.getDataColWidth() * this.x_axis_scroll_item_count);
			this.pixels_to_load = this.pixels_to_scroll + 100;
			
            if (e.data.timestamp){

				this.time_nav = e.data.timestamp;
				
                if (e.data.timestamp === -1){

                    if (this.shouldLoadMorePast()){

                        this.timestamp = this.data.axis_x_previous_page;

						// en mobile, no usamos el scroll, se recarga siempre la tabla
						if (!this.hasFixedColumns())	this.data = null;
						
                        this.form.trigger('submit', {keep_config: true, callback: this.hasFixedColumns() ? $.proxy(function(){
                                this.addAnimateScrollToQueue('-=' + this.pixels_to_scroll);
                            }, this) : false});

                    }else{
						this.addAnimateScrollToQueue('-=' + this.pixels_to_scroll);
                    }
                }
                else if (e.data.timestamp === +1){

                    if (this.shouldLoadMoreFuture()){
						
						this.timestamp = this.data.axis_x_next_page;
						
						// en mobile, no usamos el scroll, se recarga siempre la tabla
						if (!this.hasFixedColumns())	this.data = null;
						
						this.form.trigger('submit', {keep_config: true, callback: this.hasFixedColumns() ? $.proxy(function(){
							this.addAnimateScrollToQueue('+=' + this.pixels_to_scroll);
						}, this) : false});
						
					}else{
						this.addAnimateScrollToQueue('+=' + this.pixels_to_scroll);
					}
					
                }
            }

            if (e.data.page){
                this.page += e.data.page;
				this.data = null;
				
				this.form.trigger('submit', {keep_config: true});
            }
        },
		showLoading: function(){
			this.is_loading = true;
			this.loading.show();
		},
		hideLoading: function(){
			delete this.is_loading;
			for(var i = 0; i < this.opts.navSyncWith.length; i++){
				var instance = $(this.opts.navSyncWith[i]).data('AllAxisTableJS');
				if (instance.is_loading)
					return;
			}
			this.loading.hide();
		},
		isLoading: function(){
			return this.is_loading === true;
		},
		getDataColWidth: function(){
			return this.container.find('th:not(.fixed):first').outerWidth();
		},
        shouldLoadMorePast: function(){
			if (!this.hasFixedColumns()) return true;
			if (this.opts.data) return false; // si trabajamos con data estatica solo nos movemos dentro de la data
            return this.container.find('.table-responsive').scrollLeft() - this.getFixedColumnsWidth() < this.pixels_to_load;
        },
		shouldLoadMoreFuture: function(){
			//console.log("[ID=" + this.id + "] shouldLoadMoreFuture", this.hasFixedColumns(), this.container.find('.table-responsive > table:last').outerWidth(), this.container.find('.table-responsive').scrollLeft(), this.container.find('.table-responsive').outerWidth(), this.pixels_to_load);
			if (!this.hasFixedColumns()) return true;
            if (this.opts.data) return false; // si trabajamos con data estatica solo nos movemos dentro de la data
			return this.container.find('.table-responsive > table:last').outerWidth() - 
					(
						this.container.find('.table-responsive').scrollLeft() + 
						this.container.find('.table-responsive').outerWidth()
					) < this.pixels_to_load;
		},
		hasFixedColumns: function(){
			return this.container.find('table:first').is(':visible');
		},
		getFixedColumnsWidth: function(forced){
			if (!this.hasFixedColumns() && !forced) return 0;

			var width = 0;
			this.container.find('table:last th.fixed:not(.actions)').each(function(){
				width += $(this).outerWidth();
			});
			return width;
		},
		getActionColumnWidth: function(){
			return this.container.find('table:last th.fixed.actions').outerWidth();
		},
        setEvents: function(){
            if (this.opts.data){
                this.render(this.opts.data);
            }else{
                this.form.on('submit', $.proxy(this.onSubmit, this)).trigger('submit');
            }
        },
		setContainerEvents: function(){
			this.container.off('click').on('click', 'table:last td:not(.fixed)', $.proxy(this.onDataCellClick, this));
        },
		onDataCellClick: function(e){
			e.preventDefault();
			
			var cell = $(e.target);
			
			if (!cell.data('can_edit'))
				return;
			
			var input = $('<input type="number" min="0" max="99" step="1"/>')
								.val(cell.text());
								
			cell.html(input);
			
			input
				.on('keydown', $.proxy(this.onInputCellKeydown, this))
				.on('change', $.proxy(this.onInputCellChange, this))
				.on('blur', $.proxy(this.onInputCellBlur, this));
			
			
			window.setTimeout($.proxy(function(){
				this.focus().get(0).select();
			}, input), 100);
		},
		onInputCellKeydown: function(e){
			
			if (e.keyCode === 9)
				e.preventDefault();
			
			if (e.keyCode !== 9 || this.isLoading() || this.tmp_is_tab_locked)
				return;
			
			this.tmp_is_tab_locked = true;
			
			var input = $(e.target);
			input.trigger('blur');
			
			input.closest('td').next('td').trigger('click');
			
			this.btn_to_right.trigger('click', {forceSync: true, pixels_to_scroll: this.getDataColWidth()});
			
			window.setTimeout($.proxy(function(){
				delete this.tmp_is_tab_locked;
			}, this), this.scroll_speed + 100);
			
		},
		onInputCellChange: function(e){
			var callback = this.opts.onCellChange || function(){};
			var input = $(e.target);
			var cell = input.closest('td');
			callback(cell.data('row_id'), cell.data('timestamp'), input.val());
		},
		onInputCellBlur: function(e){
			window.setTimeout(function(){
				var input = $(e.target);
				input.closest('td').text(input.val());
			}, 1);
		},
		isFirstCall: function(){
			return this.data === null;
		},
        onSubmit: function(e, params){
            e.preventDefault();
			
			params = params || {};
			
            this.showLoading();

			if (this.isFirstCall() || !params.keep_config){
				this.data = null;
				this.form_data = null;
				this.form_data_history = [];
			}
			
			if (this.form_data === null){
				this.form_data = this.getFormData(params.keep_config);
			}
			
            this.form_data.timestamp	= this.timestamp;
			this.form_data.timeframe	= this.timeframe;
            this.form_data.page			= this.page;
			
			var tmp = Object.assign({}, this.form_data);
			this.form_data_history.push(tmp);
			
            $.ajax({
                url: this.form.attr('action'),
                type: this.form.attr('method') || 'get',
                data: this.form_data,
                success: $.proxy(function(data){
					
					this.render(data);
					
					if (params.callback)
						params.callback();
					
					this.hideLoading();
					
				}, this)
            });
        },
        getFormData: function(keep_config){
            var unindexed_array = this.form.serializeArray();
            var indexed_array = {};
			
            $.map(unindexed_array, function(n, i){
				if (n['name'].match(/\[\]$/)){
					if (typeof indexed_array[n['name']] === 'undefined'){
						indexed_array[n['name']] = [];
					}
					indexed_array[n['name']].push(n['value']);
				}else{
					indexed_array[n['name']] = n['value'];
				} 
            });

            if (!keep_config){

				var tmp_ts_split = indexed_array[this.opts.timestampFieldName].split('-');
				
				if (tmp_ts_split.length === 1){
					this.timestamp	= parseInt(tmp_ts_split[0]);
				}else if (tmp_ts_split.length === 2){
					this.timeframe	= parseInt(tmp_ts_split[0]);
					this.timestamp	= parseInt(tmp_ts_split[1]);
				}
				
                this.page = 1;
            }

            return indexed_array;
        },
        render: function(data){

			if (data.axis_y_items_ref.length === 0)
				return this.renderNoData();
			
			if (this.isFirstCall()){
				
				this.data = data;
				this.renderTable(data);
				this.updateTableData(data);
				this.renderNavbar(data);
				this.makeColumnsStatic();
				this.makeButtonsStatic();
				
			}else{

				if (this.time_nav === -1){
					this.renderTableBefore(data);
				}else{
					this.renderTableAfter(data);
				}

                this.updateTableData(data);

				/********/

                var axis_x_previous_page	= this.data.axis_x_previous_page;
                var axis_x_next_page		= this.data.axis_x_next_page;

                data.axis_x_previous_page 	= data.axis_x_previous_page < axis_x_previous_page ? data.axis_x_previous_page : this.data.axis_x_previous_page;
                data.axis_x_next_page 		= data.axis_x_next_page > axis_x_next_page ? data.axis_x_next_page : this.data.axis_x_next_page;

                this.data = data;
			}

			this.setAsRendered();
        },
        setAsRendered: function(){
			
			if (this.rendered)	return;
			
			this.rendered = true;

            // si todas las tablas syncronizadas estan renderizadas, igualas las columnas
            var are_all_table_rendered = true;
            for(var i = 0; i < this.opts.navSyncWith.length; i++){
                var instance = $(this.opts.navSyncWith[i]).data('AllAxisTableJS');
                if (!instance.rendered) are_all_table_rendered = false;
            };

            // si la tabla y todas sus tablas syncronizadas estan renderizadas, lanzar el evento
            if (are_all_table_rendered){
                this.onRendered();

                for(var i = 0; i < this.opts.navSyncWith.length; i++){
                    $(this.opts.navSyncWith[i]).data('AllAxisTableJS').onRendered();
                };
            }
        },
        onRendered: function(){
            this.detectOptimizedFixedColumnsWidth();
			this.detectOptimizedActionColumWidth();
			if (this.opts.onRendered) setTimeout($.proxy(function(){
				this.opts.onRendered();
			}, this), 1);
        },
        detectOptimizedFixedColumnsWidth: function(){

            var width = 0;

            for(var i = 0; i < this.opts.navSyncWith.length; i++){
                var instance = $(this.opts.navSyncWith[i]).data('AllAxisTableJS');
                width = Math.max(width, instance.getFixedColumnsWidth(true));
            }

            if (width > this.getFixedColumnsWidth(true)){
                this.forceFixedColumnsWidth(width);
            }
        },
        forceFixedColumnsWidth: function(width){
            var tableFixedCols = this.container.find('table.table.fixed-column:not(.actions) th.fixed:not(.actions), table:last th.fixed:not(.actions)');
            var widthPerColumns = width / tableFixedCols.length * 2;
            tableFixedCols.css({
                minWidth: widthPerColumns,
                maxWidth: widthPerColumns
            });
        },
		detectOptimizedActionColumWidth: function(){
			
            var width = 0;

            for(var i = 0; i < this.opts.navSyncWith.length; i++){
                var instance = $(this.opts.navSyncWith[i]).data('AllAxisTableJS');
                width = Math.max(width, instance.getActionColumnWidth());
            }
			
			width = Math.max(width, this.getActionColumnWidth());

            this.forceActionColumnWidth(width);
		},
        forceActionColumnWidth: function(width){
            this.container.find('table.table.fixed-column.actions th.fixed.actions, table:last th.fixed.actions')
							.css({minWidth: width, maxWidth: width });
        },
        makeColumnsStatic: function(){
			
            //http://jsfiddle.net/4XG7T/3/

            var $table = this.container.find('.table:last-child');
            //Make a clone of our table
            var $fixedColumn = $table.clone().removeAttr('id').insertBefore($table).addClass('fixed-column');

            //Remove everything except for first column
            $fixedColumn.find('th:not(.fixed),td:not(.fixed),th.actions,td.actions').remove();

            //Match the height of the rows to that of the original table's
            $fixedColumn.find('tr').each(function (i, elem) {
                $(this).height($table.find('tr:eq(' + i + ')').height());
            });
        },
        makeButtonsStatic: function(){

            var $table = this.container.find('.table:last-child');
            //Make a clone of our table
            var $fixedColumn = $table.clone().removeAttr('id').insertBefore($table).addClass('fixed-column actions');

            //Remove everything except for first column
            $fixedColumn.find('th:not(.actions),td:not(.actions)').remove();

            //Match the height of the rows to that of the original table's
            $fixedColumn.find('tr').each(function (i, elem) {
                $(this).height($table.find('tr:eq(' + i + ')').height());
            });
        },
        renderNavbar: function(data){
            var nb = this.container.find('.table-navbar');
            nb.find('.current-page').text(data.axis_y_current_page);
            nb.find('.total-page').text(data.axis_y_total_page_count);
            nb.find('.buttons a').removeClass('disabled');

            if (data.axis_y_current_page === 1){
                nb.find('.buttons a.page-up').addClass('disabled');
            }
            if (data.axis_y_current_page === data.axis_y_total_page_count){
                nb.find('.buttons a.page-down').addClass('disabled');
            }
        },
        formatDate: function(ts, type){
            var months = ['Ene.', 'Feb.', 'Mar.', 'Abr.', 'May.', 'Jun.', 'Jul.', 'Ago.', 'Sep.', 'Oct.', 'Nov.', 'Dic.'];
            var quarters = ['T1', null, null, 'T2', null, null, 'T3', null, null, 'T4', null, null];

            var str = this.opts.timeframeDateFormat[type];

            var date = new Date(ts);

            str = str.replace(/%W/gi, this.getWeekNumber(date)[1]);
            str = str.replace(/%C/gi, ((this.getWeekNumber(date)[0]) - 1970) * 53 + this.getWeekNumber(date)[1]);
            str = str.replace(/%MM/gi, months[date.getUTCMonth()]);
            str = str.replace(/%T/gi, quarters[date.getUTCMonth()]);
            str = str.replace(/%D/gi, date.getUTCDate() < 10 ? '0' + date.getUTCDate() : date.getUTCDate());
            str = str.replace(/%M/gi, (date.getUTCMonth()+1) < 10 ? '0' + (date.getUTCMonth()+1) : (date.getUTCMonth()+1));
            str = str.replace(/%Y/gi, date.getUTCFullYear());

            return str;
        },
        renderTable: function(data){

            var container = $('<div></div>');
            var table_responsive = $('<div class="table-responsive"></div>');
            var table = $('<table class="table" cellpadding="5"></table>');
            var thead = $('<thead></thead>');
            var tbody = $('<tbody></tbody>');
            table.append(thead);
            table.append(tbody);

            table_responsive.append(table);

            container.append(this.createNavBar());
            container.append(table_responsive);

            // creacion del header
            var row = $('<tr></tr>');

            /** @var string fixedCols */
            for (var fixedCols in data.axis_y_items_ref[0]){
                if (fixedCols === 'id' || !data.axis_x_labels[fixedCols]) continue;
                row.append($('<th class="fixed" title="' + this.htmlEntities(data.axis_x_labels[fixedCols]) + '">' + data.axis_x_labels[fixedCols] + '</th>'));
            }

			if (this.opts.buttons){
				row.append($('<th class="fixed actions text-center">Acciones</th>'));
			}
			
            this.renderHeader(row, data);

            thead.append(row);
			
            // creacion del body
            for (var i = 0; i < data.axis_y_items_ref.length; i++){
				
                row = $('<tr></tr>');
				row.data('data', data.axis_y_items_ref[i]);

                /** @var string fixedCols */
                for (var fixedCols in data.axis_y_items_ref[i]){
                    if (fixedCols === 'id' || !data.axis_x_labels[fixedCols]) continue;
					var tmp = data.axis_y_items_ref[i][fixedCols];
					var value = (tmp && tmp.content ? tmp.content : tmp);
					if (value === null){
						row.append($('<td class="fixed font-italic">&lt;sin datos&gt;</td>'));
					}else{
						row.append($('<td class="fixed" title="' + this.htmlEntities(value) + '">' + value + '</td>'));
					}
                }
				
				if (this.opts.buttons){
                    var buttons = this.opts.buttons; if (typeof buttons === 'function'){ buttons = buttons(i, data.axis_y_items_ref[i]); }
					row.append($('<td class="fixed actions">' + buttons.replace(/\{id\}/gi, data.axis_y_items_ref[i]['id']) + '</td>'));
				}
							
				this.renderRow(row, data, i);

                tbody.append(row);
            }

            this.updateContainer(container);
        },
        updateContainer: function(container){
			this.container.html(container.children());
			this.setContainerEvents();
        },
		renderNoData: function(){

			var container = $('<div><table class="table" cellpadding="5"><tr><td class="text-center">No se encontraron resultados.</td></tr></table></div>');

            this.updateContainer(container);
		},
        getWeekNumber: function(d) {
            // Copy date so don't modify original
            d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            // Set to nearest Thursday: current date + 4 - current day number
            // Make Sunday's day number 7
            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
            // Get first day of year
            var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
            // Calculate full weeks to nearest Thursday
            var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
            // Return array of year and week number
            return [d.getUTCFullYear(), weekNo];
        },
		renderTableBefore: function(data){
            var table = this.container.find("table:last");
            var thead_row = table.find('thead tr');
            var tbody_rows = table.find('tbody tr');

            var scrollRight = this.getScrollRight();

            this.renderHeader(thead_row, data, true);
            tbody_rows.each($.proxy(function(i, row){
                this.renderRow($(row), data, i, true);
            }, this));

            this.setScrollRight(scrollRight);
		},
		renderTableAfter: function(data){
            var table = this.container.find("table:last");
            var thead_row = table.find('thead tr');
            var tbody_rows = table.find('tbody tr');
			
			this.renderHeader(thead_row, data);
			tbody_rows.each($.proxy(function(i, row){
				this.renderRow($(row), data, i);
			}, this));
		},
        shouldTimestampExistAsColumn: function(timeframe, timestamp){
            var date = new Date(timestamp);
            return (
                timeframe === 0 ||
                timeframe === 1 && date.getUTCDay() === 0 ||
                timeframe === 2 && date.getUTCDate() === 1 ||
                timeframe === 3 && date.getUTCDate() === 1 && [0, 3, 6, 9].indexOf(date.getUTCMonth()) >= 0
            );
        },
        getPreviousTimeframeTimestamp(timeframe, timestamp){
            while(!this.shouldTimestampExistAsColumn(timeframe, timestamp)){
                timestamp -= 86400000;
            };
            return timestamp;
        },
        renderHeader: function(row, data, gotoLeft){

            var i = row.find('.fixed:not(.actions)').length - 1;

            for (var colTimestamp = data.axis_x_current_page; colTimestamp < data.axis_x_next_page; colTimestamp+=86400000){

                if (this.shouldTimestampExistAsColumn(data.axis_x_timeframe, colTimestamp)){

                    var html_content = $('<th>' + this.formatDate(colTimestamp, data.axis_x_timeframe) + '</th>');

                    row.find('th:eq('+ (gotoLeft ? i++ : (this.opts.buttons ? -2 : -1)) +')').after(html_content);
                }
            }
        },
        renderRow: function(row, data, row_index, gotoLeft){

            var i = row.find('.fixed:not(.actions)').length - 1;

            for (var colTimestamp = data.axis_x_current_page; colTimestamp < data.axis_x_next_page; colTimestamp+=86400000){

                if (this.shouldTimestampExistAsColumn(data.axis_x_timeframe, colTimestamp)){

                    var td = $('<td data-value="0" data-timestamp="' + colTimestamp + '" data-row_id="' + data.axis_y_items_ref[row_index]['id'] + '"></td>');
					td.data('data', data.axis_y_items_ref[row_index]);

					if (this.opts.defaultCellValue){
                        td.text(this.opts.defaultCellValue.content.value).data('can_edit', this.opts.defaultCellValue.can_edit);
                    }
					
					row.find('td:eq('+ (gotoLeft ? i++ : (this.opts.buttons ? -2 : -1)) +')').after(td);
                }
            }
        },
		reloadData: function(filter, isRecursive){
			
			this.showLoading();
			
			if (!isRecursive){
				this.tmp_reload_index = 0;
				this.tmp_reload_filter = filter || {};
			}
			
			if (this.tmp_reload_index > this.form_data_history.length-1){
				delete this.tmp_reload_index;
				delete this.tmp_reload_filter;
				return this.hideLoading();
			}
			
			var data = Object.assign({}, this.form_data_history[this.tmp_reload_index]);
			
			for (var f in this.tmp_reload_filter){
				data[f] = this.tmp_reload_filter[f];
			}
			
            $.ajax({
                url: this.form.attr('action'),
                type: this.form.attr('method') || 'get',
                data: data,
                success: $.proxy(function(data){
					
					this.updateTableData(data, true);
					
					this.tmp_reload_index++;
					this.reloadData(false, true);
					
				}, this)
            });
		},
        updateTableData: function(data, forced){
            for (var row_index = 0; row_index < data.axis_y_items.length; row_index++){

                var cell = this.container.find('td[data-row_id=' + data.axis_y_items[row_index].id + ']' +
                    '[data-timestamp=' + this.getPreviousTimeframeTimestamp(data.axis_x_timeframe, data.axis_y_items[row_index].timestamp) + ']');
					
				if (forced)
					cell.data('value', 0).text('');
					
				var item = data.axis_y_items[row_index];
				var content = item.content;
				
				if (content.css){
					// TODO ver si sirve ahi el value seteado a vacio
					cell.data('value', "").addClass(content.css);
				}
				if (typeof content.value !== "undefined"){
					cell.data('value', cell.data('value') + parseFloat(content.value));
				}

				// TODO ver si es util guardar el can_edit ahi
                cell.text(cell.data('value')).data('can_edit', item.can_edit === true).data('data', item);
            }
        },
        getScrollRight: function(){
            return this.container.find('.table-responsive > table:last').outerWidth() - this.container.find('.table-responsive').scrollLeft();
        },
        setScrollRight: function(scrollRight){
            return this.container.find('.table-responsive').scrollLeft(
                this.container.find('.table-responsive > table:last').outerWidth() - scrollRight
            );
        },
		htmlEntities: function(str){
			return $('<div/>').text(str).html();
		}
    };

	jQuery.AllAxisTableJS.getID = function(){
		if (!this.id){
			this.id = 0;
		}
		return this.id++;
	};
	
    jQuery.fn.AllAxisTableJS = function(opts){
		var elements = this;
        return this.each(function(index, el){

			var el = $(this);
		
            var o = opts || {};

            o.formSelector       = el.data('form-selector')          || o.formSelector;
            o.loadingImageSrc    = el.data('loading-image-src')      || o.loadingImageSrc;
            o.loadingImageWidth  = el.data('loading-image-width')    || o.loadingImageWidth;
            o.timestampFieldName = el.data('timestamp-field-name')    || o.timestampFieldName;

            if (o.navSyncWith){
                o.navSyncWith = $(o.navSyncWith);
            }else{
                o.navSyncWith    = o.nav_sync ? jQuery.grep(elements, function(n) { return n != el.get(0); }) : [];
            }

            var defaults = {
                formSelector: o.data ? false : 'form',
                loadingImageSrc: 'data:image/jpeg;base64,',
                loadingImageWidth: '64px',
                timestampFieldName: 'timestamp',
                timeframeDateFormat: ['%D/%M/%Y', '%D/%M/%Y', '%MM %Y', '%T %Y'],
                defaultCellValue: false,
                container: el
            };
			
			el.data('AllAxisTableJS', jQuery.extend(true, {}, jQuery.AllAxisTableJS));

            el.data('AllAxisTableJS').init($.extend(defaults, o));
        });
    };

})(jQuery);