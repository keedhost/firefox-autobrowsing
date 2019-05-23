#!/bin/bash

xhost +"local:docker@"

docker build --tag firefox-esr .

docker run --rm -it \
	--net host \
	-v /tmp/.X11-unix:/tmp/.X11-unix \
	-e PULSE_SERVER=localhost \
	-e DISPLAY=unix:0 \
	--device /dev/dri \
	--device /dev/snd \
	-v /dev/shm:/dev/shm \
	-v /etc/fonts:/etc/fonts \
	-v /etc/machine-id:/etc/machine-id \
	-v /usr/share/fonts:/usr/share/fonts \
	-v /var/run/dbus:/var/run/dbus \
	-v $(pwd)/data/iMacros:/root/.mozilla/4dw2adwz.default/iMacros \
	-v $(pwd)/data/iMacros:/root/iMacros \
	-v $(pwd)/data/profiles.ini:/root/.mozilla/firefox/profiles.ini \
	-v $(pwd)/data/extensions.json:/root/.mozilla/firefox/4dw2adwz.default/extensions.json \
	-v $(pwd)/data/{81BF1D23-5F17-408D-AC6B-BD6DF7CAF670}:/root/.mozilla/firefox/4dw2adwz.default/extensions/{81BF1D23-5F17-408D-AC6B-BD6DF7CAF670} \
	-e PGID=1000 \
	-e PUID=1000 \
	--ipc="host" \
	--name firefox-esr firefox-esr
