import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from graphrag_pkg.graph_builder import get_graph_stats
from graphrag_pkg.models import ExtractionResult, GraphNode, GraphEdge

def test_get_graph_stats_empty():
    mock_session = MagicMock()
    # 4 calls: count nodes, count edges, node types, edge types
    mock_session.execute.side_effect = [
        MagicMock(scalar=MagicMock(return_value=0)),   # count nodes
        MagicMock(scalar=MagicMock(return_value=0)),   # count edges
        MagicMock(all=MagicMock(return_value=[])),      # node types
        MagicMock(all=MagicMock(return_value=[])),      # edge types
    ]

    mock_cm = MagicMock()
    mock_cm.__enter__ = MagicMock(return_value=mock_session)
    mock_cm.__exit__ = MagicMock(return_value=False)

    with patch("graphrag_pkg.graph_builder.get_session", return_value=mock_cm):
        stats = get_graph_stats()

    assert stats["total_nodes"] == 0
    assert stats["total_edges"] == 0

def test_get_graph_stats_with_data():
    mock_session = MagicMock()
    # 4 calls: count nodes, count edges, node types, edge types
    mock_session.execute.side_effect = [
        MagicMock(scalar=MagicMock(return_value=3)),                           # count nodes
        MagicMock(scalar=MagicMock(return_value=2)),                           # count edges
        MagicMock(all=MagicMock(return_value=[("permit_type",), ("permit_type",), ("document",)])),  # node types
        MagicMock(all=MagicMock(return_value=[("requires",), ("requires",)])),  # edge types
    ]

    mock_cm = MagicMock()
    mock_cm.__enter__ = MagicMock(return_value=mock_session)
    mock_cm.__exit__ = MagicMock(return_value=False)

    with patch("graphrag_pkg.graph_builder.get_session", return_value=mock_cm):
        stats = get_graph_stats()

    assert stats["total_nodes"] == 3
    assert stats["total_edges"] == 2
    assert stats["node_types"]["permit_type"] == 2
    assert stats["node_types"]["document"] == 1
    assert stats["edge_types"]["requires"] == 2
