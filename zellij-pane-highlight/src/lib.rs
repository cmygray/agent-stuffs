use std::collections::{BTreeMap, HashSet};
use zellij_tile::prelude::*;

#[derive(Default)]
pub struct State {
    highlighted_panes: HashSet<u32>,
    panes: PaneManifest,
    tabs: Vec<TabInfo>,
}

impl ZellijPlugin for State {
    fn load(&mut self, _configuration: BTreeMap<String, String>) {
        request_permission(&[
            PermissionType::ReadApplicationState,
            PermissionType::ChangeApplicationState,
        ]);
        subscribe(&[
            EventType::PaneUpdate,
            EventType::TabUpdate,
            EventType::PermissionRequestResult,
        ]);
    }

    fn pipe(&mut self, pipe_message: PipeMessage) -> bool {
        let parts: Vec<&str> = pipe_message.name.split("::").collect();
        if parts.len() == 3 && parts[0] == "zellij-pane-highlight" {
            if let Ok(pane_id) = parts[2].parse::<u32>() {
                match parts[1] {
                    "highlight" => {
                        self.highlighted_panes.insert(pane_id);
                        highlight_and_unhighlight_panes(
                            vec![PaneId::Terminal(pane_id)],
                            vec![],
                        );
                    }
                    "unhighlight" => {
                        self.highlighted_panes.remove(&pane_id);
                        highlight_and_unhighlight_panes(
                            vec![],
                            vec![PaneId::Terminal(pane_id)],
                        );
                    }
                    _ => {}
                }
            }
        }
        unblock_cli_pipe_input(&pipe_message.name);
        false
    }

    fn update(&mut self, event: Event) -> bool {
        match event {
            Event::PaneUpdate(manifest) => {
                self.panes = manifest;
                self.check_and_clear_focus();
            }
            Event::TabUpdate(tabs) => {
                self.tabs = tabs;
            }
            Event::PermissionRequestResult(_) => {
                set_selectable(false);
            }
            _ => {}
        }
        false
    }

    fn render(&mut self, _rows: usize, _cols: usize) {}
}

impl State {
    fn check_and_clear_focus(&mut self) {
        let active_tab = match self.tabs.iter().find(|t| t.active) {
            Some(tab) => tab.position,
            None => return,
        };

        let panes = match self.panes.panes.get(&active_tab) {
            Some(panes) => panes,
            None => return,
        };

        for pane in panes {
            if pane.is_focused && !pane.is_plugin && self.highlighted_panes.remove(&pane.id) {
                highlight_and_unhighlight_panes(
                    vec![],
                    vec![PaneId::Terminal(pane.id)],
                );
            }
        }
    }
}
