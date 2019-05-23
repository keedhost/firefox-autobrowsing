FROM alpine:3.5
LABEL maintainer="andrii.kondratiev@globallogic.com"


RUN apk update && \
    apk upgrade && \
    apk add \
        ca-certificates \
        firefox-esr \
        libcanberra-gtk2 && \
    rm -rf /tmp/* /var/cache/apk/*
ENV PULSE_SERVER localhost
# ENV DISPLAY unix:0
# ADD /tmp/.X11-unix /tmp/.X11-unix
# ADD /dev/shm /dev/shm
# ADD /etc/fonts /etc/fonts
# ADD /etc/machine-id /etc/machine-id
# ADD /usr/share/fonts /usr/share/fonts
# ADD /var/run/dbus /var/run/dbus
# ADD ./data/iMacros /root/.mozilla/4dw2adwz.default/iMacros
# ADD ./data/iMacros /root/iMacros
# ADD ./data/profiles.ini /root/.mozilla/firefox/profiles.ini
# ADD ./data/extensions.json /root/.mozilla/firefox/4dw2adwz.default/extensions.json
# ADD ./data/{81BF1D23-5F17-408D-AC6B-BD6DF7CAF670} /root/.mozilla/firefox/4dw2adwz.default/extensions/{81BF1D23-5F17-408D-AC6B-BD6DF7CAF670}
	
ENTRYPOINT [ "/usr/bin/firefox" ]
