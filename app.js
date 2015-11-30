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

            get_agents: function () {
                return {
                    url:      '/api/v2/users.json?role[]=agent&role[]=admin',
                    dataType: 'json'
                }
            },

            get_all_tickets: function () {
                return {
                    url:      '/api/v2/search.json?query=type:ticket%20status<solved',
                    dataType: 'json'
                }
            },

            get_my_tickets: function () {
                return {
                    url:      '/api/v2/search.json?query=type:ticket%20assignee:me%20status<solved',
                    dataType: 'json'
                }
            },

            get_tasks: function (ticket_ids) {
                return {
                    url:      'http://admin.faithpromise.192.168.10.10.xip.io/api/tasks',
                    data:     { zendesk_ticket_ids: ticket_ids },
                    dataType: 'json',
                    cors:     true
                };
            },

            get_ticket_tasks: function (ticket_id) {
                return {
                    url:      'http://admin.faithpromise.192.168.10.10.xip.io/api/tickets/' + ticket_id + '/tasks',
                    dataType: 'json',
                    cors:     true
                };
            },

            save_task: function (ticket_id, data) {
                return {
                    url:      'http://admin.faithpromise.192.168.10.10.xip.io/api/tickets/' + ticket_id + '/tasks',
                    type:     'POST',
                    dataType: 'json',
                    data:     data,
                    cors:     true
                };
            },

            update_task: function (ticket_id, task_id, data) {
                return {
                    url:      'http://admin.faithpromise.192.168.10.10.xip.io/api/tickets/' + ticket_id + '/tasks/' + task_id,
                    type:     'PATCH',
                    dataType: 'json',
                    data:     data,
                    cors:     true
                };
            },

            delete_task: function (ticket_id, task_id) {
                return {
                    url:  'http://admin.faithpromise.192.168.10.10.xip.io/api/tickets/' + ticket_id + '/tasks/' + task_id,
                    type: 'DELETE',
                    cors: true
                };
            },

            get_requirements: function (ticket_ids) {
                return {
                    url:      'http://admin.faithpromise.192.168.10.10.xip.io/api/requirements',
                    data:     { zendesk_ticket_ids: ticket_ids },
                    dataType: 'json',
                    cors:     true
                };
            },

            get_ticket_requirements: function (ticket_id) {
                return {
                    url:      'http://admin.faithpromise.192.168.10.10.xip.io/api/tickets/' + ticket_id + '/requirements',
                    dataType: 'json',
                    cors:     true
                };
            },

            save_requirement: function (ticket_id, data) {
                return {
                    url:      'http://admin.faithpromise.192.168.10.10.xip.io/api/tickets/' + ticket_id + '/requirements',
                    type:     'POST',
                    dataType: 'json',
                    data:     data,
                    cors:     true
                };
            },

            delete_requirement: function (ticket_id, requirement_id) {
                return {
                    url:  'http://admin.faithpromise.192.168.10.10.xip.io/api/tickets/' + ticket_id + '/requirements/' + requirement_id,
                    type: 'DELETE',
                    cors: true
                };
            }

        },

        on_app_activated: function (event) {

            this.fp = this.fp || {};

            if (event.firstLoad) {
                this.load_ticket_tasks(event);
            }

        },

        on_pane_activated: function () {
            this.load_calendar();
        },

        load_ticket_tasks: function () {

            if (this.currentLocation() !== 'ticket_sidebar')
                return;

            var ticket_id = this.ticket().id();

            this.ajax('get_ticket_tasks', ticket_id).done(function (data) {

                this.format_task_dates(data.tasks);

                data.no_tasks_found    = data.tasks.length === 0;
                data.has_overdue_tasks = this._has_overdue_tasks(data.tasks);
                data.tasks             = this.split_ticket_tasks(data.tasks);

                this.switchTo('tasks', data);
            });

        },

        load_calendar: function () {

            if (this.currentLocation() !== 'nav_bar')
                return;

            var self      = this,
                agent_id  = this.currentUser().id(),
                view_data = {},
                agent_ref;

            this.when(self.ajax('get_agents'), self.ajax('get_my_tickets', agent_id))
                .done(
                function (agents_data, tickets_data) {

                    console.log('agents_data', agents_data[0].users);
                    console.log('tickets_data', tickets_data[0].results);

                    var agent_ref  = self.build_agent_reference(agents_data[0].users),
                        ticket_ref = self.build_ticket_reference(tickets_data[0].results),
                        ticket_ids = Object.keys(ticket_ref).join(',');

                    self.ajax('get_tasks', ticket_ids).done(function (data) {

                            self.format_task_dates(data.tasks);

                            view_data.total          = data.tasks.length;
                            view_data.no_tasks_found = data.tasks.length === 0;
                            view_data.categories     = this.split_calendar_tasks(data.tasks, ticket_ref, agent_ref);

                            self.switchTo('calendar', view_data);

                        }
                    );

                }
            );

            self.ajax('get_agents').done(function (agents_data) {

                agent_ref = self.build_agent_reference(agents_data.users);

                self.ajax('get_my_tickets', agent_id).done(function (tickets_data) {

                    ticket_ref = self.build_ticket_reference(tickets_data.results);

                    self.ajax('get_tasks', Object.keys(ticket_ref).join(',')).done(function (data) {

                        this.format_task_dates(data.tasks);

                        view_data.total          = data.tasks.length;
                        view_data.no_tasks_found = data.tasks.length === 0;
                        view_data.categories     = this.split_calendar_tasks(data.tasks, ticket_ref, agent_ref);

                        this.switchTo('calendar', view_data);

                    });

                });

            });

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

        mark_task_complete: function (event, ticket_id) {

            var is_sidebar  = this.currentLocation() === 'ticket_sidebar',
                is_calendar = this.currentLocation() === 'nav_bar',
                task_id     = this.$(event.target).data('task-id'),
                agent       = this.currentUser(),
                data        = {
                    completed_at:       moment().format(),
                    completed_by_email: agent.email(),
                    completed_by_name:  agent.name()
                };

            ticket_id = is_sidebar ? this.ticket().id() : this.$(event.target).data('ticket-id');

            this.ajax('update_task', ticket_id, task_id, data).done(function () {

                if (is_sidebar) {
                    this.load_ticket_tasks();
                }

                if (is_calendar) {
                    this.load_calendar();
                }

            });

        },

        mark_task_incomplete: function (event) {

            var is_sidebar  = this.currentLocation() === 'ticket_sidebar',
                is_calendar = this.currentLocation() === 'nav_bar',
                $target     = this.$(event.target),
                ticket_id   = is_sidebar ? this.ticket().id() : $target.data('ticket-id'),
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
                this.ajax('update_task', ticket_id, task_id, data).done(function () {

                    if (is_sidebar) {
                        this.load_ticket_tasks();
                    }

                    if (is_calendar) {
                        this.load_calendar();
                    }

                });
            }

        },

        delete_task: function (event) {

            var is_sidebar  = this.currentLocation() === 'ticket_sidebar',
                is_calendar = this.currentLocation() === 'nav_bar',
                task_id     = this.$(event.target).data('task-id'),
                ticket_id   = is_sidebar ? this.ticket().id() : this.$(event.target).data('ticket-id');

            this.ajax('delete_task', ticket_id, task_id).done(function () {

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

            this.ajax('save_task', ticket_id, data).done(function () {

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
                soon_before    = moment().add(7, 'days'),
                temp_date,
                is_overdue,
                is_today,
                is_soon,
                today_tasks    = [],
                soon_tasks     = [],
                future_tasks   = [],
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
