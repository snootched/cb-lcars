# CB-LCARS Documentation

> **LCARS-themed Home Assistant Custom Card**
> A powerful, highly customizable dashboard card with extensive overlay system, animations, and real-time data integration.

---

## 📚 Documentation Index

### 🚀 Getting Started
New to CB-LCARS? Start here:
- [Quick Start Guide](user-guide/getting-started/quickstart.md) - Get up and running in minutes
- [Installation](user-guide/getting-started/installation.md) - HACS and manual installation
- [Your First Card](user-guide/getting-started/first-card.md) - Create your first dashboard

### 📖 User Guide
Configuration and usage documentation:
- **Configuration**
  - [Schema Reference](user-guide/configuration/schema-reference.md) - Complete configuration options
  - [Overlays](user-guide/configuration/overlays/) - Text, buttons, lines, status grids, charts
  - [Styles & Themes](user-guide/configuration/styles-and-themes.md) - LCARS presets and customization
  - [Packs](user-guide/configuration/packs.md) - Reusable configuration bundles
  - [Animations](user-guide/configuration/animations.md) - Anime.js integration
- **How-To Guides**
  - [Connecting Overlays](user-guide/guides/connecting-overlays.md) - Lines, attachment points, and gaps
  - [Dynamic Content](user-guide/guides/dynamic-content.md) - Templates and entity integration
  - [Entity Integration](user-guide/guides/entity-integration.md) - Home Assistant entities
- **Examples**
  - [Basic Dashboard](user-guide/examples/basic-dashboard.md)
  - [Advanced Layouts](user-guide/examples/advanced-layouts.md)

### 🏗️ Architecture & Developer Docs
System design and implementation details:
- **Overview**
  - [Architecture Overview](architecture/overview.md) - High-level system design
  - [Gap System](architecture/implementation-details/gap-system.md) - Gap calculations and spacing
- **Subsystems**
  - [Subsystems Hub](architecture/subsystems/README.md) - Core subsystem documentation
  - [Systems Manager](architecture/subsystems/systems-manager.md) - Central orchestration
  - [DataSource System](architecture/subsystems/datasource-system.md) - Data processing hub
  - [Template Processor](architecture/subsystems/template-processor.md) - Template engine
  - [Rules Engine](architecture/subsystems/rules-engine.md) - Conditional logic
  - [Advanced Renderer](architecture/subsystems/advanced-renderer.md) - Rendering engine
  - [Theme System](architecture/subsystems/theme-system.md) - Token-based themes
  - [Style Resolver](architecture/subsystems/style-resolver.md) - Style resolution
  - [Animation Registry](architecture/subsystems/animation-registry.md) - Animation management
- **Implementation Details**
  - [Implementation Details Hub](architecture/implementation-details/README.md) - Technical specs
  - [Incremental Updates](architecture/implementation-details/INCREMENTAL_UPDATE_IMPLEMENTATION.md) - Efficient rendering
  - [Overlay Architecture](architecture/implementation-details/OVERLAY_ARCHITECTURE_DATA_STRUCTURES.md) - Data structures
  - [Style Standardization](architecture/implementation-details/STYLE_PROPERTY_STANDARDIZATION.md) - Property conventions

### 🔮 Proposals & Future Work
Planned features and ideas:
- [Proposals Index](proposals/README.md)
- [Planned Features](proposals/planned/)
- [Under Consideration](proposals/under-consideration/)
- [Deferred](proposals/deferred/)

### 🔧 Maintenance & History
Bug fixes and issue tracking:
- [Maintenance Index](maintenance/README.md)
- [October 2025](maintenance/2025-10/) - Recent fixes and implementations

### 🤝 Contributing
Guidelines for contributors:
- [Code Style](contributing/code-style.md)
- [Testing](contributing/testing.md)
- [Release Process](contributing/release-process.md)

---

## 🎯 Quick Links

### Most Common Tasks
- **Adding a button**: See [Button Overlay](user-guide/configuration/overlays/button.md)
- **Connecting overlays with lines**: See [Connecting Overlays](user-guide/guides/connecting-overlays.md)
- **Using entity data**: See [Dynamic Content](user-guide/guides/dynamic-content.md)
- **Styling overlays**: See [Styles & Themes](user-guide/configuration/styles-and-themes.md)

### Troubleshooting
- **Lines not connecting**: Check [Attachment Point Manager](architecture/components/attachment-point-manager.md)
- **Text rendering issues**: See [Font Stabilization](architecture/subsystems/font-stabilization.md)
- **Performance problems**: See [Incremental Updates](architecture/components/incremental-updates.md)

---

## 📦 Version Information

**Current Version**: 2025.10.1-fuk.42-69
**Last Updated**: October 26, 2025
**Compatibility**: Home Assistant 2023.1+

---

## 🔗 External Resources

- [GitHub Repository](https://github.com/snootched/cb-lcars)
- [HACS](https://hacs.xyz/) - Home Assistant Community Store
- [Home Assistant](https://www.home-assistant.io/)

---

## 📄 License

See [LICENSE](../LICENSE) file for details.
