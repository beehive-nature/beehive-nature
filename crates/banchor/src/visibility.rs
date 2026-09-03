//! STRIP-HIDDEN LAW — hidden and low-opacity text never reaches the
//! summarizer/model side.
//!
//! Anchor-daemon lane, binding law 3: "strip hidden/low-opacity text before
//! summarizing." Hidden text is the classic prompt-injection carrier: text a
//! human visitor cannot see, planted for the agent's snapshot. This module
//! classifies computed styles; axtree.rs applies the classification while
//! formatting the snapshot, BEFORE the untrusted wrapper and token count.
//!
//! Threshold ruling: opacity < 0.10 counts as "low-opacity" — below one
//! tenth, text is invisible to any practical reader, and CSS opacity
//! multiplies down the subtree, so children of a low-opacity node render
//! dimmer still. display:none and visibility:hidden|collapse kill the whole
//! SUBTREE (CSS inheritance), so those strip recursively.

/// What axtree.rs should do with a node, given its computed style.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Vis {
    /// Keep the node.
    Visible,
    /// Strip the node AND its subtree (display:none / visibility:hidden).
    HiddenTree(&'static str),
    /// Strip the node, still examine children with their own styles
    /// (low opacity / aria-hidden — children can override or re-set).
    HiddenNode(&'static str),
}

/// Classify one element from its CDP-computed style strings.
///
/// `opacity` is the computed opacity string ("0", "0.05", "1", "" if the
/// property was not returned). `aria_hidden` comes from the accessibility
/// tree's own ignored/hidden signals.
pub fn classify(display: &str, visibility: &str, opacity: &str, aria_hidden: bool) -> Vis {
    if display.eq_ignore_ascii_case("none") {
        return Vis::HiddenTree("display:none");
    }
    let vis = visibility.to_ascii_lowercase();
    if vis == "hidden" || vis == "collapse" {
        return Vis::HiddenTree("visibility:hidden");
    }
    if aria_hidden {
        return Vis::HiddenNode("aria-hidden");
    }
    if let Ok(op) = opacity.parse::<f64>() {
        if op < 0.10 {
            return Vis::HiddenNode("opacity<0.10");
        }
    }
    Vis::Visible
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_none_kills_subtree() {
        assert_eq!(
            classify("none", "visible", "1", false),
            Vis::HiddenTree("display:none")
        );
    }

    #[test]
    fn visibility_hidden_kills_subtree() {
        assert_eq!(
            classify("block", "HIDDEN", "1", false),
            Vis::HiddenTree("visibility:hidden")
        );
        assert_eq!(
            classify("block", "collapse", "1", false),
            Vis::HiddenTree("visibility:hidden")
        );
    }

    #[test]
    fn low_opacity_strips_node_only() {
        assert_eq!(
            classify("block", "visible", "0", false),
            Vis::HiddenNode("opacity<0.10")
        );
        assert_eq!(
            classify("block", "visible", "0.05", false),
            Vis::HiddenNode("opacity<0.10")
        );
        assert_eq!(
            classify("block", "visible", "0.099", false),
            Vis::HiddenNode("opacity<0.10")
        );
    }

    #[test]
    fn visible_and_boundary_opacity_kept() {
        assert_eq!(classify("block", "visible", "1", false), Vis::Visible);
        assert_eq!(classify("inline", "visible", "0.1", false), Vis::Visible);
        // unparseable/absent opacity fails OPEN to keeping the node — but
        // text nodes with UNDETERMINED styles fail CLOSED in axtree.rs
        assert_eq!(classify("block", "visible", "", false), Vis::Visible);
    }

    #[test]
    fn aria_hidden_strips_node_only() {
        assert_eq!(
            classify("block", "visible", "1", true),
            Vis::HiddenNode("aria-hidden")
        );
    }
}
