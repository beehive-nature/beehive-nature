/* SKV-2 outbound-network denial shim (Linux, unprivileged).
 * LD_PRELOAD'd into the workload child: socket() for AF_INET/AF_INET6
 * fails with ENETUNREACH; every other domain (AF_UNIX, AF_NETLINK for
 * the dynamic loader etc.) passes through to the real socket(). Direct
 * raw syscalls would bypass this libc boundary — named limitation; the
 * kernel-level netns leg (`unshare -rn`) is stronger where it is
 * permitted, and this shim is the fallback that still executes the
 * denial rather than describing it. */
#define _GNU_SOURCE
#include <dlfcn.h>
#include <errno.h>
#include <sys/socket.h>

typedef int (*socket_fn)(int, int, int);

int socket(int domain, int type, int protocol) {
    if (domain == AF_INET || domain == AF_INET6) {
        errno = ENETUNREACH;
        return -1;
    }
    static socket_fn real_socket;
    if (!real_socket) {
        real_socket = (socket_fn)dlsym(RTLD_NEXT, "socket");
    }
    return real_socket(domain, type, protocol);
}
