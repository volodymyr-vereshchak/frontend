import pandas as pd
import plotly.express as px


def get_period_graph(df: pd.DataFrame, y_axis: str, y_label: str):
    fig = px.line(df, x="period", y=y_axis)
    fig.update_layout(
        plot_bgcolor="#1a1a1a",
        paper_bgcolor="#3e3e3e",
        height=600,
        xaxis_title="Дата",
        yaxis_title=y_label,
        xaxis_title_font=dict(color="white"),
        yaxis_title_font=dict(color="white"),
        xaxis=dict(tickfont=dict(color="white"), showgrid=True, gridcolor="#3E3E3E"),
        yaxis=dict(tickfont=dict(color="white"), showgrid=True, gridcolor="#3E3E3E"),
    )
    fig.update_traces(line=dict(color="#b9e42b", width=3))
    return fig
