var poolModule = require('generic-pool');
var cheerio = require('cheerio');
var request = require('request');
var low = require('lowdb');
var db = low('db.json');

var pool = poolModule.Pool({
    create: function(callback) { callback(null, {}); },
    destroy: function(c) { },
    max: 1
});

function fetchSessionInfo(url) {
    pool.acquire(function(err, client) {
	console.log(url);
	var obj = {
	    url: url,
	    title: unescape(url.replace(/.*:/,'')),
	    startTime: 'TBD',
	    location: 'TBD',
	    duration: 'TBD',
	};

	url = url.replace(/.*wiki\//, 'https://events.ccc.de/camp/2015/wiki/index.php?title=') + '&action=formedit';
	request(url, function(error, response, body) {
	    if (!error && response.statusCode == 200) {
		var $ = cheerio.load(body);
		var evt = {};
		var name = '';

		obj.title = $('#firstHeading').html().substr(25);

		$('input').each(function() {
		    if ($(this).attr('name'))
			name = $(this).attr('name').match(/([^\[\]]*)\[([^\[\]]*)\]/);

		    if (!name)
			return;

		    if (name[1] === 'Event' && name[2] !== 'num') {
			var name = $(this).attr('name').match(/([^\[\]]*)\[([^\[\]]*)\]\[([^\[\]]*)\]/);
			if (!evt[name[2]])
			    evt[name[2]] = {};

			evt[name[2]][name[3]] = $(this).val();
		    } else if (name[1] === 'Session') {
			if (!$(this).val())
			    $(this).val('');

			if (name[2] === 'Has session type')
			    obj.type = $(this).val();
			else if (name[2] === 'Held in language') 
			    obj.language = $(this).val();
			else if (name[2] === 'Has session tag') 
			    obj.tags = $(this).val();
			else if (name[2] === 'Is for kids') 
			    obj.forKids = $(this).val();
			else if (name[2] === 'Has description') 
			    obj.description = $(this).val();
			else if (name[2] === 'Has website') 
			    obj.website = $(this).val();
			else if (name[2] === 'Has session keywords') 
			    obj.keywords = $(this).val();
			else if (name[2] === 'Processed by village') 
			    obj.village = $(this).val();
			else if (name[2] === 'Is organized by') 
			    obj.organizedby = $(this).val();
			else if (name[2] === 'Has orga contact') 
			    obj.contact = $(this).val();
			else if (name[2] === 'Is related to') 
			    obj.relatedProject = $(this).val();
		    }
		});

		var hasTimeSlot = false;
		for (var k in evt) {
		    hasTimeSlot = true;

		    obj.startTime = new Date(evt[k]['Has start time']);
		    obj.location = evt[k]['Has session location'];
		    obj.duration = evt[k]['Has duration'];

		    db('events').push(obj);
		}

		// save event with unassigned time
		if (!hasTimeSlot)
		    db('events').push(obj);
	    }
	    pool.release(client);
	});
    });
};

request('https://events.ccc.de/camp/2015/wiki/Category:Session', function(error, response, body) {
    var d = new Date();
    db('lastupdate').remove();
    db('lastupdate').push(d.toUTCString());
    db('events').remove();

    if (!error && response.statusCode == 200) {
	var $ = cheerio.load(body);
	$('.mw-category-group').find('li').each(function() {
	    fetchSessionInfo($(this).children('a').attr('href'));
	});
    }
});
