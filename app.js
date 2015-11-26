(function () {

    return {

        events: {
            'app.activated':                  'on_app_activated',
            'pane.activated':                 'on_pane_activated',
            'click .js_mark_task_complete':   'mark_task_complete',
            'click .js_mark_task_incomplete': 'mark_task_incomplete',
            'click .js_delete_task':          'delete_task',
            'click .js_show_task_form':       'show_task_form',
            'click .js_cancel_task_form':     'cancel_task_form',
            'submit .js_save_task':           'save_task'
        },

        requests: {

            getTasksByTicket: function (ticket_id) {
                return {
                    url:      'http://admin.faithpromise.192.168.10.10.xip.io/api/tickets/' + ticket_id + '/tasks',
                    type:     'GET',
                    dataType: 'json',
                    cors:     true
                };
            },

            save: function (ticket_id, data) {

                return {
                    url:      'http://admin.faithpromise.192.168.10.10.xip.io/api/tickets/' + ticket_id + '/tasks',
                    type:     'POST',
                    dataType: 'json',
                    data:     data,
                    cors:     true
                };
            },

            update: function (ticket_id, task_id, data) {

                return {
                    url:      'http://admin.faithpromise.192.168.10.10.xip.io/api/tickets/' + ticket_id + '/tasks/' + task_id,
                    type:     'PATCH',
                    dataType: 'json',
                    data:     data,
                    cors:     true
                };
            },

            delete: function (ticket_id, task_id) {

                return {
                    url:  'http://admin.faithpromise.192.168.10.10.xip.io/api/tickets/' + ticket_id + '/tasks/' + task_id,
                    type: 'DELETE',
                    cors: true
                };
            }

        },

        // Nav bar
        on_pane_activated: function () {

            if (this.currentLocation() === 'nav_bar') {
                this.switchTo('calendar');
            }

        },

        // Ticket sidebar
        on_app_activated: function (event) {

            this.fp = {};

            if (this.currentLocation() === 'ticket_sidebar' && event.firstLoad) {
                this.load_ticket_tasks();
            }

        },

        load_ticket_tasks: function () {

            var ticket_id = this.ticket().id();

            this.ajax('getTasksByTicket', ticket_id).done(function (data) {
                this.fp.tasks          = data.tasks; // TODO: needs to be different than calendar tasks
                this.format_task_dates(data.tasks);
                data.no_tasks_found    = data.tasks.length === 0;
                data.has_overdue_tasks = this._has_overdue_tasks();
                data.tasks             = this.split_ticket_tasks(data.tasks);
                this.switchTo('tasks', data);
            });

        },

        load_calendar: function() {
            alert('load calendar');
        },

        mark_task_complete: function (event, ticket_id) {

            var is_sidebar = this.currentLocation() === 'ticket_sidebar',
                is_calendar = this.currentLocation() === 'nav_bar',
                task_id = this.$(event.target).data('task-id'),
                agent   = this.currentUser(),
                data    = {
                    completed_at:       moment().format(),
                    completed_by_email: agent.email(),
                    completed_by_name:  agent.name()
                };

            if (is_sidebar) {
                ticket_id = this.ticket().id();
            }

            this.ajax('update', ticket_id, task_id, data).done(function () {

                if (is_sidebar) {
                    this.load_ticket_tasks();
                }

                if (is_calendar) {
                    this.load_calendar();
                }

            });

        },

        mark_task_incomplete: function (event, ticket_id) {

            var is_sidebar = this.currentLocation() === 'ticket_sidebar',
                is_calendar = this.currentLocation() === 'nav_bar',
                $target    = this.$(event.target),
                task_id    = $target.data('task-id'),
                task_title = $target.data('task-title'),
                data       = {
                    completed_at:       null,
                    completed_by_email: null,
                    completed_by_name:  null
                };

            if (is_sidebar) {
                ticket_id = this.ticket().id();
            }

            // Checkbox has no meaning. It's just a visual. So, if it stays
            // in incomplete, make sure it's always checked.
            if ($target.is(':checkbox')) { $target.prop('checked', true); }

            if (confirm('Are you sure you want to mark the task,\n"' + task_title + '" incomplete?')) {
                this.ajax('update', ticket_id, task_id, data).done(function () {

                    if (is_sidebar) {
                        this.load_ticket_tasks();
                    }

                    if (is_calendar) {
                        this.load_calendar();
                    }

                });
            }

        },

        delete_task: function (event, ticket_id) {

            var is_sidebar = this.currentLocation() === 'ticket_sidebar',
                is_calendar = this.currentLocation() === 'nav_bar',
                task_id   = this.$(event.target).data('task-id');

            if (is_sidebar) {
                ticket_id = this.ticket().id();
            }

            this.ajax('delete', ticket_id, task_id).done(function () {

                if (is_sidebar) {
                    this.load_ticket_tasks();
                }

                if (is_calendar) {
                    this.load_calendar();
                }

            });

        },

        show_task_form: function () {

            var ticket_id      = this.ticket().id(),
                title_selector = '#fp_task_title_' + ticket_id,
                data           = {
                    ticket_id: this.ticket().id()
                };

            this.switchTo('task_form', data);
            this.$(title_selector).focus();

            // TODO: Can't get datepicker to work
            //this.$('#fp_task_due_at').datepicker({dateFormat: "yy-mm-dd"});
        },

        save_task: function (event) {

            var ticket_id       = this.ticket().id(),
                title_selector  = '#fp_task_title_' + ticket_id,
                title           = this.$(title_selector).val(),
                due_at_selector = '#fp_task_due_at_' + ticket_id,
                due_at          = this.$(due_at_selector).val(),
                data            = {
                    title:  title,
                    due_at: moment(due_at).endOf('day').format()
                };

            event.preventDefault();

            this.ajax('save', ticket_id, data).done(function () {

                services.notify('New task added', 'notice');
                this.show_task_form();

            });

        },

        cancel_task_form: function () {
            this.load_ticket_tasks();
        },

        format_task_dates: function (tasks) {

            var i, now = moment(), due, due_diff, completed, date_format = 'ddd, MMM D, YYYY';

            for (i = 0; i < tasks.length; i++) {

                due      = moment(tasks[i].due_at);
                due_diff = now.diff(due, 'days');

                completed = tasks[i].completed_at ? moment(tasks[i].completed_at) : null;

                tasks[i].due_at_formatted       = due.format(date_format);
                tasks[i].completed_at_formatted = completed ? completed.format(date_format) : '';

                tasks[i].due_at_friendly       = Math.abs(due_diff) <= 7 ? due.calendar().replace(' at 11:59 PM', '') : due.from(now);
                tasks[i].completed_at_friendly = completed ? completed.calendar().replace(' at 11:59 PM', '') : '';

            }

        },

        split_ticket_tasks: function (tasks) {

            var i, now = moment(), is_overdue, result = {incomplete: [], complete: []};

            for (i = 0; i < tasks.length; i++) {

                is_overdue = moment(tasks[i].due_at).isBefore(now);

                if (tasks[i].completed_at) {
                    tasks[i].status = 'complete';
                    result.complete.push(tasks[i]);

                } else if (is_overdue) {
                    tasks[i].status = 'overdue';
                    result.incomplete.push(tasks[i]);

                } else {
                    tasks[i].status = 'incomplete';
                    result.incomplete.push(tasks[i]);
                }
            }

            return result;
        },

        _has_overdue_tasks: function () {

            var i, now = moment();

            for (i = 0; i < this.fp.tasks.length; i++) {
                if (!this.fp.tasks[i].completed_at && moment(this.fp.tasks[i].due_at).isBefore(now)) {
                    return true;
                }
            }
            return false;
        }

    };

}());
