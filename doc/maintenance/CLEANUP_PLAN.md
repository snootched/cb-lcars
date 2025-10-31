# Documentation Cleanup Plan

> **Consolidation and archiving of legacy documentation**
> Track which old files have been superseded by new documentation.

**Date:** October 26, 2025
**Session:** Documentation Reorganization Phase 5

---

## 📊 Progress Summary

### New Documentation Created

**Total:** 18,500+ lines across 19 new files

#### Phase 1-2: Foundation (4 files, 1,500 lines)
- ✅ `/doc/README.md` - Root navigation hub
- ✅ `/doc/architecture/overview.md` - Data-centric architecture
- ✅ `/doc/architecture/subsystems/datasource-system.md` - DataSource architecture
- ✅ `/doc/architecture/implementation-details/gap-system.md` - Gap system (335 lines)

#### Phase 3: DataSource Documentation (5 files, 4,750 lines)
- ✅ `/doc/user-guide/configuration/datasources.md` - Main guide (850 lines)
- ✅ `/doc/user-guide/configuration/datasource-transformations.md` - Transformations (1,150 lines)
- ✅ `/doc/user-guide/configuration/datasource-aggregations.md` - Aggregations (1,400 lines)
- ✅ `/doc/user-guide/configuration/computed-sources.md` - Computed sources (1,150 lines)
- ✅ `/doc/user-guide/examples/datasource-examples.md` - Examples (2,100 lines)

#### Phase 4: Overlay Documentation (6 files, 9,650 lines)
- ✅ `/doc/user-guide/configuration/overlays/README.md` - Hub (650 lines)
- ✅ `/doc/user-guide/configuration/overlays/text-overlay.md` - Text guide (1,450 lines)
- ✅ `/doc/user-guide/configuration/overlays/button-overlay.md` - Button guide (1,600 lines)
- ✅ `/doc/user-guide/configuration/overlays/line-overlay.md` - Line guide (1,800 lines)
- ✅ `/doc/user-guide/configuration/overlays/status-grid-overlay.md` - Status grid (2,100 lines)
- ✅ `/doc/user-guide/configuration/overlays/apexcharts-overlay.md` - ApexCharts (2,050 lines)

#### Phase 5: Subsystems Documentation (5 files, 3,600 lines)
- ✅ `/doc/architecture/subsystems/README.md` - Hub (350 lines)
- ✅ `/doc/architecture/subsystems/systems-manager.md` - Systems Manager (650 lines)
- ✅ `/doc/architecture/subsystems/rules-engine.md` - Rules Engine (850 lines)
- ✅ `/doc/architecture/subsystems/advanced-renderer.md` - Renderer (800 lines)
- ✅ `/doc/architecture/subsystems/theme-system.md` - Theme System (700 lines)

---

## 📁 Files to Archive

### `/doc/user/` Directory (29 files)

#### ✅ Superseded by New Documentation

| Old File | Status | Superseded By | Action |
|----------|--------|---------------|--------|
| `datasource_complete_documentation.md` | ✅ Obsolete | datasources.md, transformations, aggregations, computed | **Archive** |
| `datasource_transformation_chaining_guide.md` | ✅ Obsolete | datasource-transformations.md | **Archive** |
| `enhanced_datasource_guide.md` | ✅ Obsolete | datasources.md | **Archive** |
| `enhanced_datasource_examples.md` | ✅ Obsolete | datasource-examples.md | **Archive** |
| `text-overlay.md` | ✅ Obsolete | overlays/text-overlay.md | **Archive** |
| `text_overlay_complete_documentation.md` | ✅ Obsolete | overlays/text-overlay.md | **Archive** |
| `button-overlay.md` | ✅ Obsolete | overlays/button-overlay.md | **Archive** |
| `button_overlay_complete_documentation.md` | ✅ Obsolete | overlays/button-overlay.md | **Archive** |
| `status-grid-overlay.md` | ✅ Obsolete | overlays/status-grid-overlay.md | **Archive** |
| `status_grid_overlay_complete_documentation.md` | ✅ Obsolete | overlays/status-grid-overlay.md | **Archive** |
| `apexchart.md` | ✅ Obsolete | overlays/apexcharts-overlay.md | **Archive** |
| `sparkline-overlay.md` | ✅ Obsolete | overlays/apexcharts-overlay.md (deprecated) | **Archive** |
| `sparkline_overlay_complete_documentation.md` | ✅ Obsolete | overlays/apexcharts-overlay.md (deprecated) | **Archive** |
| `history_bar_overlay_complete_documentation.md` | ✅ Obsolete | overlays/apexcharts-overlay.md (deprecated) | **Archive** |
| `rules_engine_complete_documentation.md` | ✅ Obsolete | subsystems/rules-engine.md | **Archive** |
| `theme_system_complete_reference.md` | ✅ Obsolete | subsystems/theme-system.md | **Archive** |
| `unified_styling_system_reference.md` | ✅ Obsolete | subsystems/theme-system.md | **Archive** |

#### 🔄 To Be Reviewed/Consolidated

| Old File | Status | Notes | Action |
|----------|--------|-------|--------|
| `new_datasources.md` | 🔄 Review | May contain implementation notes | **Review & Archive** |
| `datasource_chaining_test_plan.md` | 🔄 Review | Test plan - may archive | **Review & Archive** |
| `home_assistant_templates.md` | 📋 Keep? | Template syntax reference | **Review** |
| `msd-actions.md` | 📋 Keep? | Action system docs | **Review** |
| `msd-controls.md` | 📋 Keep? | Control system docs | **Review** |
| `style-resolution.md` | 📋 Keep? | Style resolution details | **Review** |
| `style-resolver-api.md` | 📋 Keep? | StyleResolver API | **Review** |
| `provenance.md` | 📋 Keep? | System provenance | **Review** |
| `theme_creation_tutorial.md` | 📋 Update? | Theme tutorial | **Update or consolidate** |
| `token_reference_card.md` | 📋 Update? | Token quick reference | **Update or consolidate** |
| `validation_guide.md` | 📋 Keep? | Validation system | **Review** |

#### 📦 Configuration Examples

| Old File | Status | Action |
|----------|--------|--------|
| `apexchart-advanced.yaml` | 📦 Example | Keep as reference |

---

## 📋 Action Plan

### Step 1: Create Archive Directory ✅

```bash
mkdir -p /home/jweyermars/code/cb-lcars/doc/archive/2025-10-pre-reorg
```

### Step 2: Archive Superseded Files

Move clearly superseded files to archive:

```bash
# DataSource files
mv doc/user/datasource_complete_documentation.md doc/archive/2025-10-pre-reorg/
mv doc/user/datasource_transformation_chaining_guide.md doc/archive/2025-10-pre-reorg/
mv doc/user/enhanced_datasource_guide.md doc/archive/2025-10-pre-reorg/
mv doc/user/enhanced_datasource_examples.md doc/archive/2025-10-pre-reorg/

# Overlay files
mv doc/user/text-overlay.md doc/archive/2025-10-pre-reorg/
mv doc/user/text_overlay_complete_documentation.md doc/archive/2025-10-pre-reorg/
mv doc/user/button-overlay.md doc/archive/2025-10-pre-reorg/
mv doc/user/button_overlay_complete_documentation.md doc/archive/2025-10-pre-reorg/
mv doc/user/status-grid-overlay.md doc/archive/2025-10-pre-reorg/
mv doc/user/status_grid_overlay_complete_documentation.md doc/archive/2025-10-pre-reorg/
mv doc/user/apexchart.md doc/archive/2025-10-pre-reorg/
mv doc/user/sparkline-overlay.md doc/archive/2025-10-pre-reorg/
mv doc/user/sparkline_overlay_complete_documentation.md doc/archive/2025-10-pre-reorg/
mv doc/user/history_bar_overlay_complete_documentation.md doc/archive/2025-10-pre-reorg/

# System files
mv doc/user/rules_engine_complete_documentation.md doc/archive/2025-10-pre-reorg/
mv doc/user/theme_system_complete_reference.md doc/archive/2025-10-pre-reorg/
mv doc/user/unified_styling_system_reference.md doc/archive/2025-10-pre-reorg/
```

### Step 3: Review Remaining Files

Review and categorize remaining 12 files:

1. **home_assistant_templates.md** - Extract useful content, consolidate
2. **msd-actions.md** - Create new action system doc
3. **msd-controls.md** - Create new controls doc
4. **style-resolution.md** - Consolidate into subsystems/style-resolver.md
5. **style-resolver-api.md** - Consolidate into subsystems/style-resolver.md
6. **provenance.md** - Review for archival
7. **theme_creation_tutorial.md** - Update or consolidate into theme-system.md
8. **token_reference_card.md** - Update or create new quick reference
9. **validation_guide.md** - Create subsystems/validation-system.md
10. **new_datasources.md** - Review and archive
11. **datasource_chaining_test_plan.md** - Archive
12. **apexchart-advanced.yaml** - Keep as example

### Step 4: Clean Up `/doc/msd/` Directory

Review MSD overlay documentation:

```bash
ls -la doc/msd/overlays/
# apexchart-multi.md - Already consolidated into overlays/apexcharts-overlay.md
```

Move to archive if superseded.

### Step 5: Update Navigation

Update root README to reflect new structure:
- Remove references to archived files
- Add links to new subsystem docs
- Update quick start guides

---

## 📈 Progress Tracking

### Completion Status

- ✅ Phase 1-2: Foundation documentation (4 files)
- ✅ Phase 3: DataSource documentation (5 files)
- ✅ Phase 4: Overlay documentation (6 files)
- ✅ Phase 5a: Core subsystems documentation (5 files)
- 📋 Phase 5b: Remaining subsystems (3-4 files pending)
- 📋 Phase 6: File consolidation and archival
- 📋 Phase 7: Final cleanup and navigation updates

### Files Summary

| Category | Created | Archived | Remaining | Action Needed |
|----------|---------|----------|-----------|---------------|
| **Foundation** | 4 | - | - | ✅ Complete |
| **DataSource** | 5 | 4 | - | ✅ Complete |
| **Overlays** | 6 | 10 | - | ✅ Complete |
| **Subsystems** | 5 | 3 | 3-4 | 🔄 In progress |
| **User Docs** | - | - | 12 | 📋 To review |
| **MSD Docs** | - | - | 2 | 📋 To review |

---

## 🎯 Next Steps

1. ✅ Create archive directory
2. 📋 Archive clearly superseded files (17 files)
3. 📋 Review remaining user/ files (12 files)
4. 📋 Create remaining subsystem docs (3-4 files)
5. 📋 Update root README navigation
6. 📋 Final cleanup and validation

---

**Last Updated:** October 26, 2025
**Status:** Phase 5a Complete - Ready for archival
