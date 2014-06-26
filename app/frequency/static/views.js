
App.FrequencyResultListView = Backbone.View.extend({
    initialize: function (options) {
        this.render();
    },
    render: function () {
        App.debug('App.FrequencyResultListView.render()');
        this.collection.each(function (m) {
            var view = new App.FrequencyResultView({
                model: m
            });
            this.$el.append(view.el);
        }, this);
    }
});

App.FrequencyResultView = Backbone.View.extend({
    template: _.template($('#tpl-frequency-result-view').html()),
    initialize: function (options) {
        this.render();
    },
    render: function () {
        App.debug('App.FrequencyResultView.render()');
        this.$el.html(this.template());
        this.$('.frequency-result-view-content').html('Hello, World!');
    }
});
