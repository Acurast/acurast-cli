#include <ifaddrs.h>
#include <string.h>
#include <stdlib.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <net/if.h>

int getifaddrs(struct ifaddrs **ifap) {
    struct ifaddrs *ifa = calloc(1, sizeof(struct ifaddrs));
    if (!ifa) return -1;
    ifa->ifa_next = NULL;
    ifa->ifa_name = strdup("lo");
    ifa->ifa_flags = IFF_UP | IFF_RUNNING | IFF_LOOPBACK;

    struct sockaddr_in *addr = calloc(1, sizeof(struct sockaddr_in));
    addr->sin_family = AF_INET;
    addr->sin_addr.s_addr = htonl(0x7f000001);
    ifa->ifa_addr = (struct sockaddr *)addr;

    struct sockaddr_in *netmask = calloc(1, sizeof(struct sockaddr_in));
    netmask->sin_family = AF_INET;
    netmask->sin_addr.s_addr = htonl(0xff000000);
    ifa->ifa_netmask = (struct sockaddr *)netmask;

    *ifap = ifa;
    return 0;
}

void freeifaddrs(struct ifaddrs *ifa) {
    while (ifa) {
        struct ifaddrs *next = ifa->ifa_next;
        free(ifa->ifa_name);
        free(ifa->ifa_addr);
        free(ifa->ifa_netmask);
        free(ifa);
        ifa = next;
    }
}
