#!/bin/sh
nohup npm run be-data > /root/data.log 2>&1 &
nohup npm run be-mngr > /root/mngr.log 2>&1 &
nohup npm run be-bots > /root/bots.log 2>&1 &
nohup npm run ac-serv > /root/auth.log 2>&1 &
nohup npm run be-puzs > /root/puzs.log 2>&1 &
#npm run ac-serv
