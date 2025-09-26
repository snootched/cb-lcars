import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * Position Resolver - Utility for resolving positions and anchor points
 */

export class PositionResolver {
  static resolvePosition(position, anchors) {
    if (Array.isArray(position) && position.length >= 2) {
      return [Number(position[0]), Number(position[1])];
    }

    if (typeof position === 'string' && anchors[position]) {
      const anchorPos = anchors[position];
      if (Array.isArray(anchorPos) && anchorPos.length >= 2) {
        return [Number(anchorPos[0]), Number(anchorPos[1])];
      }
    }

    cblcarsLog.warn('[PositionResolver] Could not resolve position:', position);
    return null;
  }
}
