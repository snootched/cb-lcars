# Maintenance Documentation

This folder contains historical issue tracking, bug fixes, and feature implementation documentation organized by date.

## Purpose

These documents track the evolution of the codebase through:
- Bug fixes and their root cause analysis
- Feature implementations and completion tracking
- Diagnostic sessions and problem-solving approaches
- Test setup and configuration standardization

## Organization

Documents are organized by **year-month** (e.g., `2025-10/`) to maintain chronological context.

## 2025-10 (October 2025)

### Major Work Completed

#### Attachment System Improvements
- **Attachment Point Consolidation** - Unified attachment point management
- **Auto-Attach Implementation** - Geometry-based automatic side determination
- **Gap System** - `anchor_gap` and `attach_gap` for line offsets
- **Font Stabilization Fix** - Prevented invalid bbox updates during font loading

#### Incremental Update System
- **Button Overlay** - Phase 3 completion, incremental updates
- **Text Overlay** - Incremental updates with bbox validation
- **Status Grid** - Cleanup and rules engine fixes
- **ApexCharts** - Color mapping and incremental updates

#### Bug Fixes
- **Auto-Attach Side** - Fixed side write-back issue
- **Routing Debug** - Restored debug infrastructure
- **Style Update Content Filter** - Fixed content filtering
- **DOM Element Lookup** - Improved element resolution
- **Rules Engine** - Fixed StatusGrid property handling
- **Line Attachment** - Font stabilization race condition
- **Text Overlay Cache** - Fixed caching issues
- **Border Rendering** - Fixed button border updates

### Index of Documents

See individual files in `2025-10/` folder for detailed information.

---

## How to Use These Documents

**For Developers:**
- Reference when encountering similar issues
- Understand the history of design decisions
- Learn from problem-solving approaches

**For Users:**
- Generally not needed for normal usage
- Refer to `../user-guide/` for configuration and usage

**For Contributors:**
- Review recent fixes before proposing changes
- Check if your issue has been previously addressed
- Learn the codebase through issue resolution history

