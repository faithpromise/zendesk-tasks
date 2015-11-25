(function () {

    return {

        events: {
            'app.activated':                  'init',
            'click .js_mark_task_complete':   'mark_task_complete',
            'click .js_mark_task_incomplete': 'mark_task_incomplete',
            'click .js_delete_task':          'delete_task',
            'click .js_show_task_form':       'show_task_form',
            'click .js_cancel_task_form':     'cancel_task_form',
            'submit .js_save_task':           'save_task'
        },

        requests: {

            getTasks: function (ticket_id) {
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

                console.log('data', data);

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

        init: function () {
            this.fp = {};
            this.load_tasks();
            //this.switchTo('task_form');
        },

        load_tasks: function () {
            var ticket_id = this.ticket().id();

            this.ajax('getTasks', ticket_id).done(function (data) {
                this.fp.tasks          = data.tasks;
                this.format_task_dates(data.tasks);
                data.no_tasks_found    = data.tasks.length === 0;
                data.has_overdue_tasks = this._has_overdue_tasks();
                data.tasks             = this.split_tasks(data.tasks);
                this.switchTo('tasks', data);
            });
        },

        mark_task_complete: function (event) {

            var ticket_id = this.ticket().id(),
                task_id   = this.$(event.target).data('task-id'),
                agent     = this.currentUser(),
                data      = {
                    completed_at:       moment().format(),
                    completed_by_email: agent.email(),
                    completed_by_name:  agent.name()
                };

            this.ajax('update', ticket_id, task_id, data).done(function () {
                this.load_tasks();
            });

        },

        mark_task_incomplete: function (event) {

            var $target    = this.$(event.target),
                ticket_id  = this.ticket().id(),
                task_id    = $target.data('task-id'),
                task_title = this._get_task_title(task_id),
                data       = {
                    completed_at:       null,
                    completed_by_email: null,
                    completed_by_name:  null
                };

            // Checkbox has no meaning. It's just a visual. So, if it stays
            // in incomplete, make sure it's always checked.
            if ($target.is(':checkbox')) { $target.prop('checked', true); }

            if (confirm('Are you sure you want to mark the task,\n"' + task_title + '" incomplete?')) {
                this.ajax('update', ticket_id, task_id, data).done(function () {
                    this.load_tasks();
                });
            }

        },

        delete_task: function (event) {

            var ticket_id = this.ticket().id(),
                task_id   = this.$(event.target).data('task-id');

            this.ajax('delete', ticket_id, task_id).done(function () {
                this.load_tasks();
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

            console.log('data', data);

            event.preventDefault();

            this.ajax('save', ticket_id, data).done(function () {
                services.notify('New task added', 'notice');
                this.show_task_form();
            });

        },

        cancel_task_form: function () {
            this.load_tasks();
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

            console.log(tasks);

        },

        split_tasks: function (tasks) {

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

        _get_task_title: function (id) {

            var i;

            for (i = 0; i < this.fp.tasks.length; i++) {
                if (this.fp.tasks[i].id == id) {
                    return this.fp.tasks[i].title;
                }
            }
            return 'Unknown';
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
