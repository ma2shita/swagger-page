// required underscore.js 1.8.3 or higher, handlebars.js 4.0.5 or higher, marked.js 0.3.5 or higher
// Usage:
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.8.3/underscore-min.js"></script>
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/handlebars.js/4.0.5/handlebars.min.js"></script>
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/0.3.5/marked.min.js"></script>
//   <script src="swagger-page.js"></script>
//   <script>
//     var swaggerPage = new SwaggerPage({src: Swagger2.0APIJSON_or_String});
//     document.getElementById('target').innerHTML = swaggerPage.renderHTML('toc_apis');
//   </script>

/*
 * TODO:
 * - example w/ curl
 * - suppress in case of empty list
 * - Validation for JSON
 * - support basePath
 */

SwaggerPage = function(params) {
	// params
	//   .src = source text(as JSON) or JSON
	this.swaggerObj = this.JSONfy(params.src);
	this.apis = this.extractPaths(this.swaggerObj.paths, this.endpoint_prefix(this.swaggerObj));
	this.models = this.extractDefinitions(this.swaggerObj.definitions);
};

SwaggerPage.prototype.isJSON = function(target) {
	var r = Object.prototype.toString.call(target);
	return (r == '[object Object]' || r == '[object JSON]');
};

SwaggerPage.prototype.JSONfy = function(json_or_string) {
	if (this.isJSON(json_or_string)) {
		return json_or_string;
	} else {
		return (new Function('return ' + json_or_string))(); // REF: http://hamalog.tumblr.com/post/4047826621/json%E3%82%89%E3%81%97%E3%81%8D%E6%96%87%E5%AD%97%E5%88%97%E3%82%92%E3%82%AA%E3%83%96%E3%82%B8%E3%82%A7%E3%82%AF%E3%83%88%E3%81%AB%E5%A4%89%E6%8F%9B%E3%81%99%E3%82%8Bjavascript
	}
};

SwaggerPage.prototype.endpoint_prefix = function(swaggerObj) {
	var basepath = swaggerObj.basePath || "";
	var url = location.protocol+'//'+location.hostname+(location.port ? ':' + location.port : '') + basepath;
	return url;
};

SwaggerPage.prototype.extractPaths = function(swagger_paths, endpoint_prefix) {
	var apis = [];
	_.each(swagger_paths, function(ev, ek) {
		_.each(ev, function(iv, ik) {
			var api = {
				endpoint_prefix: endpoint_prefix, // NOTE: Opps. Workaround for `curl` helper in Handlebar.js
				id: iv.operationId,
				path: ek,
				method: ik.toUpperCase(),
				tag: iv.tags[0],
				spec: iv
			};
			apis.push(api);
		});
	});
	// NOTE: more improve sort logic!!
	var sorted = _.sortBy(apis, function(i) {
		var m = {'GET':1, 'POST': 2, 'PUT': 3, 'DELETE': 4}[i.method];
		var l = i.path.length;
		r = [i.tag, m, l].join(',');
		return r;
	});
	var r = {list: sorted};
	return r;
};

SwaggerPage.prototype.extractDefinitions = function(swagger_definitions) {
	var models = [];
	_.each(swagger_definitions, function(ev, ek) {
		var model = {
			id: ek,
			name: ek,
			properties: ev.properties
		}
		models.push(model);
	});
	var sorted = _.sortBy(models, function(i){
		return i.name;
	});
	var r = {list: sorted};
	return r;
};

SwaggerPage.prototype.renderHTML = function(target) {
	switch(target.toLowerCase()) {
		case 'toc_apis':
			var html = Handlebars.compile(this.tpl_toc_apis)(this.apis);
			break;
		case 'toc_models':
			var html = Handlebars.compile(this.tpl_toc_models)(this.models);
			break;
		case 'spec_apis':
			var html = Handlebars.compile(this.tpl_spec_api)(this.apis);
			break;
		case 'spec_models':
			var html = Handlebars.compile(this.tpl_spec_model)(this.models);
			break;
		default:
			var html = "";
			break;
	}
	return html;
};

Handlebars.registerHelper('mkd', function(text) {
	try {
	   	var r = marked(text);
	} catch(e) {
		var r = '';
	}
	return new Handlebars.SafeString(r);
});

Handlebars.registerHelper('model_link', function(ref) {
	try {
		var a = ref.split('/');
		var n = a[a.length-1];
		var r = '<a href="#' + n + '">' + n + '</a>';
	} catch(e) {
		var r = 'Undef. Please call to our support!'
	}
	return new Handlebars.SafeString(r);
});

Handlebars.registerHelper('tp', function(type, ref) {
	if (type) {
		var r = type;
	} else {
		// NOTE: Copy&Paste code from model_link (Improve DRY)
		try {
			var a = ref.split('/');
			var n = a[a.length-1];
			var r = '<a href="#' + n + '">' + n + '</a>';
		} catch(e) {
			var r = 'Undef. Please call to our support!'
		}
	}
	return new Handlebars.SafeString(r);
});

Handlebars.registerHelper('curl', function(obj) {
	var headers = _.map(obj.spec.headers, function(v, k) {
		if (v.required == true) {
			v["name"] = k;
			return v;
		} else {
			return null;
		}
	});

	// NOTE: `in` is query in DELETE method, maybe BUG!!
	var params = _.filter(obj.spec.parameters, function(i) {
		return (i.in == "formData" && i.required == true);
	});

	var qs = _.filter(obj.spec.parameters, function(i) {
		return (i.in == "query" && i.required == true);
	});

	r = [];
	r.push('curl', '-w', '"\\n"');
	_.each(headers, function(i) {
		if (i) { r.push('-H', '"'+ i.name+': VALUE"'); }
	});
	_.each(params, function(i) {
		if (i) { r.push('-d', '"'+ i.name+'=VALUE"'); }
	});
	r.push('\\', '\n', '-X', obj.method.toUpperCase(), obj.endpoint_prefix + obj.path);
	if (qs.length > 0) {
		var q = [];
		_.each(qs, function(i) {
			if (i) { q.push(i.name+'=VALUE'); }
		});
		var querystring = '?'+q.join('&');
	} else {
		var querystring = '';
	}

	return new Handlebars.SafeString(r.join(' ')+querystring);
});

SwaggerPage.prototype.tpl_toc_apis = '\
<dl class="toc apis">\
  {{#list}}\
  <dt class="endpoint"><a href="#{{id}}"><span class="method">{{method}}</span> <span class="path">{{path}}</span></a></dt>\
  <dd class="summary">{{spec.summary}}</dd>\
  {{/list}}\
</dl>';

SwaggerPage.prototype.tpl_toc_models = '\
<ul class="list-unstyled toc models">\
  {{#list}}\
  <li class="item"><a href="#{{id}}">{{name}}</a></li>\
  {{/list}}\
</ul>';

SwaggerPage.prototype.tpl_spec_api = '\
{{#list}}\
<div id="{{id}}" class="spec api {{method}}">\
  <h2 class="title"><span class="method">{{method}}</span> <span class="path">{{path}}</span></h2>\
  <div class="summary">{{mkd spec.summary}}</div>\
  <div class="description">{{mkd spec.description}}</div>\
\
  <h3 class="field-label">Request</h3>\
\
  <h4 class="field-sub-label">Endpoint</h4>\
  <p class="endpoint"><code>{{method}} {{path}}</code></p>\
\
  <h4 class="field-sub-label">Headers</h4>\
  <table class="table table-bordered table-sm req-headers">\
    <thead>\
      <tr>\
        <th>Header</th>\
        <th>Description</th>\
        <th>Required</th>\
      </tr>\
    </thead>\
    <tbody>\
	  {{#each spec.headers}}\
      <tr>\
        <td class="header">{{@key}}</td>\
        <td class="desc">{{description}}</td>\
        <td class="required">{{required}}</td>\
      </tr>\
	  {{/each}}\
    </tbody>\
  </table>\
\
  <h4 class="field-sub-label">Parameters</h4>\
  <table class="table table-bordered table-sm req-params">\
    <thead>\
      <tr>\
        <th>Name</th>\
        <th>Description</th>\
        <th>Type</th>\
        <th>Required</th>\
      </tr>\
    </thead>\
    <tbody>\
	  {{#spec.parameters}}\
      <tr>\
        <td class="name">{{name}}</td>\
        <td class="desc">\
		  Parameter to be set in {{in}}<br />\
          {{description}}\
        </td>\
        <td class="type">{{type}}</td>\
        <td class="required">{{required}}</td>\
      </tr>\
	  {{/spec.parameters}}\
    </tbody>\
  </table>\
\
  <h3 class="field-label">Response</h3>\
  <table class="table table-bordered table-sm responses">\
    <thead>\
      <tr>\
        <th>Code</th>\
        <th>Description</th>\
        <th>Type</th>\
      </tr>\
    </thead>\
    <tbody>\
	  {{#each spec.responses}}\
      <tr>\
        <td class="code">{{@key}}</td>\
        <td class="desc">{{description}}</td>\
        <td class="type">{{model_link schema.$ref}}</td>\
      </tr>\
	  {{/each}}\
    </tbody>\
  </table>\
\
  <h3 class="example">Example</h3>\
  <pre><code class="console">{{curl this}}</code></pre>\
</div>\
{{/list}}';

SwaggerPage.prototype.tpl_spec_model = '\
{{#list}}\
<div id="{{id}}" class="spec model">\
  <h2 class="title"><span class="name">{{name}}</span></h2>\
  <table class="table table-bordered table-sm properties">\
    <thead>\
      <tr>\
        <th>Name</th>\
        <th>Description</th>\
        <th>Type</th>\
      </tr>\
    </thead>\
    <tbody>\
	  {{#each properties}}\
      <tr>\
        <td class="name">{{@key}}</td>\
        <td class="desc">{{description}}</td>\
        <td class="type">{{tp type $ref}}</td>\
      </tr>\
	  {{/each}}\
    </tbody>\
  </table>\
</div>\
{{/list}}';
