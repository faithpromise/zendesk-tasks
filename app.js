(function () {

    var api_url,
        calendar_mode = 'my_tickets';

    /*
     Zendesk says don't access window, but I can't think of
     another way to conditionally set environment (is_dev)
     than accessing the window object.
     */
    (function () {

        var window = this,
            is_dev = /zat=true/.test(window.location.href),
            style  = window.document.createElement('style'),
            app_id = is_dev ? '0' : '74931';

        api_url = is_dev ? 'http://admin.faithpromise.192.168.10.10.xip.io' : 'http://admin.faithpromise.org';

        style.appendChild(window.document.createTextNode(''));
        window.document.head.appendChild(style);

        style.sheet.insertRule('.app-' + app_id + '.apps_ticket_sidebar { background-color: transparent !important; padding-left: 10px !important; padding-right: 10px !important; clear: both; width: 330px !important; border: none !important; }', 0);
        style.sheet.insertRule('.app-' + app_id + '.apps_nav_bar { margin-top: 0 !important; padding: 0 !important; }', 0);

    })();

    return {

        events: {
            'app.activated':                'on_app_activated',
            'pane.activated':               'on_pane_activated',
            'click .js_new':                'new',
            'click .js_edit':               'edit',
            'click .js_cancel_edit':        'cancel_edit',
            'submit .js_save':              'save',
            'click .js_delete':             'delete',
            'click .js_mark_complete':      'mark_complete',
            'click .js_mark_incomplete':    'mark_incomplete',
            'click .js_load_my_calendar':   'load_my_calendar',
            'click .js_load_full_calendar': 'load_full_calendar'
        },

        requests: {

            agents: function () {
                return {
                    url:      '/api/v2/users.json?role[]=agent&role[]=admin',
                    dataType: 'json'
                };
            },

            tickets: function () {
                return {
                    url:      '/api/v2/search.json?query=type:ticket%20status<solved',
                    dataType: 'json'
                };
            },

            my_tickets: function () {
                return {
                    url:      '/api/v2/search.json?query=type:ticket%20assignee:me%20status<solved',
                    dataType: 'json'
                };
            },

            tasks: function (ticket_ids) {
                return {
                    url:      api_url + '/api/ticket-tasks',
                    data:     { zendesk_ticket_ids: ticket_ids },
                    dataType: 'json',
                    cors:     true
                };
            },

            task: function (task_id) {
                return {
                    url:      api_url + '/api/ticket-tasks/' + task_id,
                    dataType: 'json',
                    cors:     true
                };
            },

            create: function (data) {
                return {
                    url:      api_url + '/api/ticket-tasks',
                    type:     'POST',
                    dataType: 'json',
                    data:     data,
                    cors:     true
                };
            },

            update: function (data, task_id) {
                return {
                    url:      api_url + '/api/ticket-tasks/' + task_id,
                    type:     'PATCH',
                    dataType: 'json',
                    data:     data,
                    cors:     true
                };
            },

            delete: function (task_id) {
                return {
                    url:  api_url + '/api/ticket-tasks/' + task_id,
                    type: 'DELETE',
                    cors: true
                };
            }

        },

        on_app_activated: function (event) {

            if (event.firstLoad) {
                this.load_ticket_sidebar(event);
            }

        },

        on_pane_activated: function () {
            this.load_calendar();
        },

        load_ticket_sidebar: function () {

            if (this.currentLocation() !== 'ticket_sidebar')
                return;

            var ticket_id = this.ticket().id();

            this.ajax('tasks', ticket_id).done(function (result) {

                var view_data = {};

                this.format_task_dates(result.data);

                view_data.no_tasks_found    = result.data.length === 0;
                view_data.has_overdue_tasks = this._has_overdue_tasks(result.data);
                view_data.tasks             = this.split_ticket_tasks(result.data);

                this.switchTo('tasks', view_data);
            });

        },

        load_my_calendar: function () {
            calendar_mode = 'my_tickets';
            this.load_calendar();
        },

        load_full_calendar: function () {
            calendar_mode = 'tickets';
            this.load_calendar();
        },

        load_calendar: function () {

            if (this.currentLocation() !== 'nav_bar')
                return;

            var self      = this,
                agent_id  = this.currentUser().id(),
                view_data = {};

            this.when(self.ajax('agents'), self.ajax(calendar_mode, agent_id))
                .done(
                    function (agents_data, tickets_data) {

                        var agent_ref = self.build_agent_reference(agents_data[0].users),
                            ticket_ref = self.build_ticket_reference(tickets_data[0].results),
                            ticket_ids = Object.keys(ticket_ref).join(',');

                        self.ajax('tasks', ticket_ids).done(function (result) {

                                self.format_task_dates(result.data);

                                view_data.is_my_calendar = (calendar_mode === 'my_tickets');
                                view_data.total          = result.data.length;
                                view_data.no_tasks_found = result.data.length === 0;
                                view_data.categories     = this.split_calendar_tasks(result.data, ticket_ref, agent_ref);

                                self.switchTo('calendar', view_data);

                            }
                        );

                    }
                );

        },

        build_agent_reference: function (agents) {

            var i, ref = {};

            for (i = 0; i < agents.length; i++) {
                ref[agents[i].id] = {
                    id:    agents[i].id,
                    name:  agents[i].name,
                    photo: agents[i].photo ? agents[i].photo.content_url : '//assets.zendesk.com/images/types/user_sm.png'
                };
            }

            return ref;

        },

        build_ticket_reference: function (tickets) {

            var i, ref = {};

            for (i = 0; i < tickets.length; i++) {
                ref[tickets[i].id] = {
                    id:            tickets[i].id,
                    assignee_id:   tickets[i].assignee_id,
                    subject:       tickets[i].subject,
                    status:        tickets[i].status,
                    status_abbrev: tickets[i].status.substr(0, 1)
                };
            }

            return ref;

        },

        new: function () {

            var ticket_id      = this.ticket().id(),
                title_selector = '#fp_task_title_' + ticket_id,
                data           = {
                    id:                null,
                    zendesk_ticket_id: ticket_id,
                    title:             '',
                    due_at:            ''
                };

            this.switchTo('task_form', data);
            this.$(title_selector).focus();

            // TODO: Can't get datepicker to work
            //this.$('#fp_task_due_at').datepicker({dateFormat: "yy-mm-dd"});
        },

        edit: function (event) {

            var task_id = this.$(event.currentTarget).data('task-id');

            this.ajax('task', task_id).done(function (result) {
                this.switchTo('task_form', result.data);
            });

        },

        cancel_edit: function () {
            this.load_ticket_sidebar();
        },

        save: function (event) {

            var ticket_id = this.ticket().id(),
                task_id   = this.$('#fp_task_id_' + ticket_id).val(),
                title     = this.$('#fp_task_title_' + ticket_id).val(),
                due_at    = this.$('#fp_task_due_at_' + ticket_id).val(),
                mode      = task_id ? 'update' : 'create',
                data      = {
                    zendesk_ticket_id: this.ticket().id(),
                    title:             title,
                    due_at:            moment(due_at).endOf('day').format()
                };

            event.preventDefault();

            this.ajax(mode, data, task_id).done(function () {

                if (mode === 'create') {
                    services.notify('New task added', 'notice');
                    this.new();
                } else {
                    this.load_ticket_sidebar();
                }

            });

        },

        delete: function (event) {

            var is_sidebar  = this.currentLocation() === 'ticket_sidebar',
                is_calendar = this.currentLocation() === 'nav_bar',
                $target     = this.$(event.currentTarget),
                task_id     = $target.data('task-id'),
                task_title  = $target.data('task-title');

            if (!confirm('Are you sure you want to delete the task,\n"' + task_title + '"')) {
                return;
            }

            this.ajax('delete', task_id).done(function () {

                if (is_sidebar) {
                    this.load_ticket_sidebar();
                }

                if (is_calendar) {
                    this.load_calendar();
                }

            });

        },

        mark_complete: function (event) {

            var is_sidebar  = this.currentLocation() === 'ticket_sidebar',
                is_calendar = this.currentLocation() === 'nav_bar',
                task_id     = this.$(event.currentTarget).data('task-id'),
                agent       = this.currentUser(),
                data        = {
                    completed_at:       moment().format(),
                    completed_by_email: agent.email(),
                    completed_by_name:  agent.name()
                };

            this.ajax('update', data, task_id).done(function () {

                if (is_sidebar) {
                    this.load_ticket_sidebar();
                }

                if (is_calendar) {
                    this.load_calendar();
                }

            });

        },

        mark_incomplete: function (event) {

            var is_sidebar  = this.currentLocation() === 'ticket_sidebar',
                is_calendar = this.currentLocation() === 'nav_bar',
                $target     = this.$(event.currentTarget),
                task_title  = $target.data('task-title'),
                task_id     = $target.data('task-id'),
                data        = {
                    completed_at:       null,
                    completed_by_email: null,
                    completed_by_name:  null
                };

            // Checkbox has no meaning. It's just a visual. So, if it stays
            // in incomplete, make sure it's always checked.
            if ($target.is(':checkbox')) { $target.prop('checked', true); }

            if (confirm('Are you sure you want to mark the task,\n"' + task_title + '" incomplete?')) {
                this.ajax('update', data, task_id).done(function () {

                    if (is_sidebar) {
                        this.load_ticket_sidebar();
                    }

                    if (is_calendar) {
                        this.load_calendar();
                    }

                });
            }

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

            var i, now = moment(), is_overdue, result = { incomplete: [], complete: [] };

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

        split_calendar_tasks: function (tasks, ticket_ref, agent_ref) {

            var i,
                now            = moment(),
                soon_before = moment().add(7, 'days'),
                temp_date,
                is_overdue,
                is_today,
                is_soon,
                today_tasks = [],
                soon_tasks  = [],
                future_tasks = [],
                complete_tasks = [];

            for (i = 0; i < tasks.length; i++) {

                temp_date = moment(tasks[i].due_at);

                is_overdue = temp_date.isBefore(now);
                is_today   = temp_date.isSame(now, 'day');
                is_soon    = !is_today && !is_overdue && temp_date.isBefore(soon_before);

                tasks[i].is_completed = tasks[i].completed_at ? true : false;
                tasks[i].ticket       = ticket_ref[tasks[i].zendesk_ticket_id];
                tasks[i].agent        = agent_ref[tasks[i].ticket.assignee_id];

                if (tasks[i].completed_at) {
                    tasks[i].status = 'complete';
                    complete_tasks.push(tasks[i]);

                } else if (is_overdue || is_today) {
                    tasks[i].status = is_overdue ? 'overdue' : 'incomplete';
                    today_tasks.push(tasks[i]);

                } else if (is_soon) {
                    tasks[i].status = 'incomplete';
                    soon_tasks.push(tasks[i]);

                } else {
                    tasks[i].status = 'incomplete';
                    future_tasks.push(tasks[i]);
                }
            }

            return [
                { title: 'Due Today', tasks: today_tasks, count: today_tasks.length },
                { title: 'Next 7 Days', tasks: soon_tasks, count: soon_tasks.length },
                { title: 'Upcoming', tasks: future_tasks, count: future_tasks.length },
                { title: 'Completed', tasks: complete_tasks, count: complete_tasks.length }
            ];
        },

        _has_overdue_tasks: function (tasks) {

            var i, now = moment();

            for (i = 0; i < tasks.length; i++) {
                if (!tasks[i].completed_at && moment(tasks[i].due_at).isBefore(now)) {
                    return true;
                }
            }
            return false;
        }

    };

}());
