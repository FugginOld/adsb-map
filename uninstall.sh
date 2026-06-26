#!/bin/bash

instance=adsb-map
echo --------------
if [[ -n $1 ]]; then
	instance="adsb-map-$1"
    rm -rf "/usr/local/share/adsb-map/html-$1"
    echo "Removing adsb-map, instance name $instance!"
else
    echo "Removing adsb-map, all instances!"
	rm -rf /usr/local/share/adsb-map
    rm -f /etc/lighttpd/conf-available/*adsb-map*
    rm -f /etc/lighttpd/conf-enabled/*adsb-map*
fi
echo --------------

systemctl stop "$instance"
systemctl disable "$instance"

#rm -f /etc/default/$instance
echo "Configuration is left to be removed manually, you can use this command:"
echo "sudo rm /etc/default/$instance"
rm -f "/lib/systemd/system/$instance.service"

rm -f "/etc/lighttpd/conf-available/88-$instance.conf"
rm -f "/etc/lighttpd/conf-enabled/88-$instance.conf"
rm -f "/etc/lighttpd/conf-available/99-$instance-webroot.conf"
rm -f "/etc/lighttpd/conf-enabled/99-$instance-webroot.conf"


systemctl daemon-reload
systemctl restart lighttpd



echo --------------
echo "adsb-map is now gone! Shoo shoo!"
