
(function () {
    var socket = io();
    var el = document.getElementById('server-time');
    var LOOP_FREQUENCY = 6000;
    var started = false;
    var startTimer = null;
    var acknowledgeTimer = null;
    var lastDrops = "";
    var statusTimer = null;

    function crankItUp() {
        if (startTimer) {
            clearTimeout(startTimer);
        }

        startTimer = setTimeout(function () {
            var sessionId = $('#session-id').val();
            if (sessionId && !started) {
                $('#session-id').addClass('disabled').attr('disabled', 'disabled');

                started = true;

                //SEND THE SESSION ID TO THE SERVER TO TELL IT TO GET THE DATA AND SUBSCRIBE TO THE ROOM
                socket.emit('sessionId', sessionId, function (data) {
                    console.log(data);
                });

                socket.on(sessionId, function (message) {
                    var thisDrops = "";
                    var html = '<table class="table table-striped"><thead class="thead-inverse"><tr><th colspan="2">Your Loot</th></tr></thead><tbody>';

                    if (message.error) {
                        thisDrops = message.error;
                        html += '<tr class="table-danger"><td colspan="2"><strong>' + message.error + '</td></tr>';
                    } else if (message.drops == 0) {
                        thisDrops = "no drops";
                        html += '<tr class="table-warning"><td colspan="2"><strong>Nope!</strong> There ain\'t nothing dropping.</td></tr>';
                    } else {
                        $.each(message.drops, function (i, drop) {
                            var rarity = parseInt(drop.rarity);

                            thisDrops += (drop.name + ' x' + drop.num);

                            html += '<tr class="table-' + (rarity > 4 ? 'success' : 'info') + '">';
                            html += '<td class="img-cell">';
                            html += '<img class="img-fluid" src="' + drop.image + '" />';
                            html += '</td>';
                            html += '<td>';
                            html += (drop.name + ' x' + drop.num);
                            if (drop.round) {
                                html += ' - Round ' + drop.round;
                            }
                            if (drop.dropRate) {
                                console.log('uncached!')
                                // We have to increase the server value by one, because the client actually tells the server if it was a new drop
                                drop.dropRate.hits++;
                                drop.dropRate.total++;
                                drop.dropRate.rate = (drop.dropRate.hits * 1.0) / (drop.dropRate.total * 1.0);
                                
                                html += '<p>Drop Rate: ' + Math.round(drop.dropRate.rate * 100) + '% - ' + (drop.dropRate.hits) + ' out of ' + (drop.dropRate.total) + ' drops for this battle have been for this item.</p>';
                            }
                            html += '</td>';
                            html += '</tr>';
                        });
                    }

                    html += '</tbody></table>';

                    if (lastDrops != thisDrops) { //DON'T ADD IT AGAIN IF IT'S THE SAME AS LAST TIME
                        $('#attach-point').prepend(html);

                        $.each(message.drops, function (i, drop) {
                            var rarity = parseInt(drop.rarity);

                            var worthSending = rarity >= 5 || (rarity >= 4 && drop.name.indexOf('Orb') != -1);

                            if (drop.item_id) {
                                socket.emit('recordDrop', [drop.battle_id, drop.item_id], function (data) {
                                    console.log(data);
                                });
                            }

                            if (worthSending && ($('#email').val() || $('#phone').val())) {
                                socket.emit('notify', [drop, $('#email').val(), $('#phone').val()], function (data) {
                                    console.log(data);
                                });
                            }
                        });
                    }

                    lastDrops = thisDrops;

                    if (acknowledgeTimer) {
                        clearTimeout(acknowledgeTimer);
                    }

                    //WAIT A FEW SECONDS THEN TELL THE SERVER TO SEND ANOTHER UPDATE
                    acknowledgeTimer = setTimeout(function () {
                        socket.emit('sessionId', sessionId, function (data) {
                            console.log(data);
                        });
                    }, LOOP_FREQUENCY);
                });
            }
        }, 100);
    }

    $('#btn-instructions').click(function (event) {
        event.preventDefault();

        $('#instructions').toggle();
    })

    $('#session-id').change(crankItUp);

    $('#session-id').on('paste', crankItUp);

    statusTimer = setTimeout(function () {
        $('.badge-default').hide();
        $('.badge-success').hide();
        $('.badge-danger').show();
    }, LOOP_FREQUENCY);

    socket.on('time', function (timeString) {
        clearTimeout(statusTimer);
        statusTimer = setTimeout(function () {
            $('.badge-default').hide();
            $('.badge-success').hide();
            $('.badge-danger').show();
        }, LOOP_FREQUENCY);

        $('.badge-default').hide();
        $('.badge-success').show();
        $('.badge-danger').hide();
        // el.innerHTML = 'Server time: ' + timeString;
    });
})();