
# Contents
- [Purpose](#purpose)
- [Stability Levels](#stability-levels)
- [Core](#core)
- [TTVM](#ttvm)
- [Replays](#replays)

# Purpose
This file documents the stability of all features, formats, and protocols. Use this file to determine what APIs, formats, features, and protocols you will rely on.

# Stability Levels

### Mature
Items marked as 'mature' are fully matured and stable. These items will not be changed in the future with the exception of deprecation.

### Stable
Items marked as 'stable' are stable and will continue to be supported, but are not fully mature and may be worked on in the future. Stable items may be relied on safely.  
Note that items marked as 'stable' may not be the latest stable version of that feature, always prefer the latest stable version.

### Nightly
Items marked as 'nightly' are entirely unreliable. These items are in early development/highly experimental and will be changed at any time for any reason. Do not rely on these items.

### Deprecated
Items marked as 'deprecated' are documented, but are no longer supported and may be removed without warning. Do not create new code that relies on deprecated items, migrate old code if possible.  
Note that it is possible and indeed likely that features marked as 'deprecated' will suggest using nightly features instead. In this case, wait until the nightly feature becomes stable.

### Obsolete
Items marked as 'obsolete' are documented and functional, but are not guaranteed to continue being supported. Do not write new code that relies on obsolete items, migrate old code if possible. Refer to the item's documentation for what, if anything, has replaced it.

# Core
Core features, protocols, and formats. These items are core to the operation of Territopple.

| Item | Stability | Notes |
|-|-|-|
| Server-Client Communication Format | Mature |

# Replays
The Replay sections covers the replay file formats, reserved extmeta keys, and all other replay related features.

| Item | Stability | Notes |
|-|-|-|
| Format (prior to V6) | Deprecated | use the latest format |
| Reserved extmeta keys | Nightly |
| Event Extensions | Nightly |
| Inline Topology | Deprecated | use the 'link' extmeta once available |
| Format V6 (latest) | Stable |

# TTVM
The TTVM section covers the ttvm format, opcodes, TASM, and the VM itself.

| Item | Stability | Notes |
|-|-|-|
| Topology Rules [1] | Deprecated | use ttvm instead |
| TTVM Format V1 (latest) | Nightly |
| TASM | Nightly |
| VM | Nightly |

[1] - This is distinct from TTVM object files as the original format did not include a purpose or an indx section.

# TTVM Types
This section covers the stability of the representation of types in the TTVM.

| Item | Stability | Notes |
|-|-|-|
| Numeric Types <= 64 bits | Stable |
| Numeric Types > 64 bits | Nightly |
| Unsized Array | Nightly |
| Sized Array | Stable |
| Opaque Struct | Stable |
| Transparent Struct | Nightly |
| SStr | Stable |
| LStr | Stable |
| Pointer | Stable |

# TTVM 3tr
The TTVM 3tr section covers features exclusive to the 3tr purpose.

| Item | Stability | Notes |
|-|-|-|
| @constructor | Stable |
| @getpositionof | Nightly | see Unsized Array |
| @getneighbors | Nightly | see Unsized Array |
| @getrequiredbits | Stable |
